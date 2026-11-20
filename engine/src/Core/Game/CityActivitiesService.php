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
 * ZONE v149 City Activities Suite:
 * - NPC Mission Agents (Duke, Mayor Tariq, Layla, Madame Vega) + Mission Armory Shop
 * - Shared City Dump (`city-dump-pool-v1`) with toss honor & 5E search
 * - Duke's Loan Shark (level-scaled cap, 5% vigorish, >72h Enforcer Heat)
 * - 3 Torn Spin Wheels (Lame $1k, Mediocre $50k, Awesome $1M)
 * - Harbor & Safari Hunting (Beginner 10E, Standard 15E, Master 25E @ hunting >= 50)
 * - Garage & 5-Class Street Racing League (6 cars, 5 tuning parts, 6 multi-lap 8-car tracks)
 */
final class CityActivitiesService
{
    public const DUMP_META_KEY = 'city-dump-pool-v1';
    public const LOAN_OVERDUE_SECONDS = 259200; // 72h
    public const LOAN_VIGORISH_BPS = 500;       // 5%

    /** @var array<string, array<string, string>> */
    public const AGENTS = [
        'duke' => [
            'id' => 'duke',
            'nameEn' => 'Duke',
            'nameAr' => 'دوق',
            'roleEn' => 'Harbor Loan Shark & Enforcer',
            'roleAr' => 'قرش القروض ومنفّذ المرفأ',
        ],
        'mayor_tariq' => [
            'id' => 'mayor_tariq',
            'nameEn' => 'Mayor Tariq',
            'nameAr' => 'العمدة طارق',
            'roleEn' => 'Shadow City Hall Patron',
            'roleAr' => 'راعي ديوان الظل البلدي',
        ],
        'layla' => [
            'id' => 'layla',
            'nameEn' => 'Layla',
            'nameAr' => 'ليلى',
            'roleEn' => 'Dockside Fixer & Informant',
            'roleAr' => 'وسيطة الأرصفة والمعلومات',
        ],
        'madame_vega' => [
            'id' => 'madame_vega',
            'nameEn' => 'Madame Vega',
            'nameAr' => 'مدام فيغا',
            'roleEn' => 'Cartel Smuggling Matriarch',
            'roleAr' => 'عرّابة التهريب الدولي',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const MISSION_ARMORY = [
        'flash_grenade' => [
            'id' => 'flash_grenade',
            'costCredits' => 20,
            'kind' => 'item',
            'itemId' => 'flash_grenade',
            'quantity' => 1,
            'nameEn' => 'Tactical Flash Grenade',
            'nameAr' => 'قنبلة ضوئية تكتيكية',
        ],
        'bloodbag' => [
            'id' => 'bloodbag',
            'costCredits' => 25,
            'kind' => 'item',
            'itemId' => 'bloodbag',
            'quantity' => 1,
            'nameEn' => 'Sterile Blood Bag',
            'nameAr' => 'كيس دم معقم',
        ],
        'lawyer_card' => [
            'id' => 'lawyer_card',
            'costCredits' => 30,
            'kind' => 'item',
            'itemId' => 'lawyer_card',
            'quantity' => 1,
            'nameEn' => 'Lawyer Business Card',
            'nameAr' => 'بطاقة محامي الطوارئ',
        ],
        'epinephrine' => [
            'id' => 'epinephrine',
            'costCredits' => 35,
            'kind' => 'item',
            'itemId' => 'epinephrine',
            'quantity' => 1,
            'nameEn' => 'Combat Epinephrine Injector',
            'nameAr' => 'حقنة إبينفرين قتالية',
        ],
        'skill_xp_book' => [
            'id' => 'skill_xp_book',
            'costCredits' => 40,
            'kind' => 'skill_book',
            'skillBonus' => 25,
            'xpBonus' => 250,
            'nameEn' => '+25 Skill XP Book',
            'nameAr' => 'كتاب خبرة المهارات (+25)',
        ],
        'xanax' => [
            'id' => 'xanax',
            'costCredits' => 45,
            'kind' => 'item',
            'itemId' => 'xanax',
            'quantity' => 1,
            'nameEn' => 'Xanax (+250 Energy)',
            'nameAr' => 'زاناكس (+250 طاقة)',
        ],
        'edvd' => [
            'id' => 'edvd',
            'costCredits' => 75,
            'kind' => 'item',
            'itemId' => 'edvd',
            'quantity' => 1,
            'nameEn' => 'Erotic DVD (+2500 Happy)',
            'nameAr' => 'قرص ترفيهي (+2500 سعادة)',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const SPIN_WHEELS = [
        'lame' => [
            'id' => 'lame',
            'costCash' => 1000,
            'cooldownSeconds' => 2,
            'nameEn' => 'Wheel of Lame',
            'nameAr' => 'عجلة البسطاء (1,000$)',
            'prizes' => [
                ['id' => 'cash_2500', 'weight' => 3000, 'type' => 'cash', 'amount' => 2500, 'labelEn' => '$2,500 Street Cash', 'labelAr' => '2,500$ نقداً'],
                ['id' => 'cash_5000', 'weight' => 1500, 'type' => 'cash', 'amount' => 5000, 'labelEn' => '$5,000 Mini Jackpot', 'labelAr' => 'جائزة 5,000$'],
                ['id' => 'item_smallkit', 'weight' => 2000, 'type' => 'item', 'itemId' => 'smallkit', 'qty' => 1, 'labelEn' => '1x First Aid Kit', 'labelAr' => 'حقيبة إسعاف أولي'],
                ['id' => 'item_drink', 'weight' => 1500, 'type' => 'item', 'itemId' => 'drink', 'qty' => 2, 'labelEn' => '2x Street Energy Drink', 'labelAr' => 'مشروبا طاقة'],
                ['id' => 'points_2', 'weight' => 1200, 'type' => 'points', 'amount' => 2, 'labelEn' => '+2 Syndicate Points', 'labelAr' => '+2 نقاط نقابة'],
                ['id' => 'hosp_slap', 'weight' => 800, 'type' => 'hosp', 'minutes' => 10, 'labelEn' => 'Leslie Lead-Pipe Slap (10m Hospital)', 'labelAr' => 'صفعة ليزلي (10 دقائق مستشفى)'],
            ],
        ],
        'mediocre' => [
            'id' => 'mediocre',
            'costCash' => 50000,
            'cooldownSeconds' => 2,
            'nameEn' => 'Wheel of Mediocre',
            'nameAr' => 'العجلة المتوسطة (50,000$)',
            'prizes' => [
                ['id' => 'cash_75000', 'weight' => 2600, 'type' => 'cash', 'amount' => 75000, 'labelEn' => '$75,000 Cash Bundle', 'labelAr' => 'رزمة 75,000$'],
                ['id' => 'cash_175000', 'weight' => 1200, 'type' => 'cash', 'amount' => 175000, 'labelEn' => '$175,000 Harbor Jackpot', 'labelAr' => 'جائزة 175,000$'],
                ['id' => 'item_medkit', 'weight' => 2000, 'type' => 'item', 'itemId' => 'medkit', 'qty' => 2, 'labelEn' => '2x Trauma Medkits', 'labelAr' => 'حقيبتا إسعاف متقدم'],
                ['id' => 'item_plush_camel', 'weight' => 1600, 'type' => 'item', 'itemId' => 'plush_camel', 'qty' => 1, 'labelEn' => '1x Desert Camel Plushie', 'labelAr' => 'دمية الجمل النادرة'],
                ['id' => 'points_10', 'weight' => 1200, 'type' => 'points', 'amount' => 10, 'labelEn' => '+10 Syndicate Points', 'labelAr' => '+10 نقاط نقابة'],
                ['id' => 'item_bloodbag', 'weight' => 600, 'type' => 'item', 'itemId' => 'bloodbag', 'qty' => 1, 'labelEn' => '1x Sterile Blood Bag', 'labelAr' => 'كيس دم معقم'],
                ['id' => 'hosp_slap', 'weight' => 800, 'type' => 'hosp', 'minutes' => 10, 'labelEn' => 'Spinning Brick Drop (10m Hospital)', 'labelAr' => 'سقوط طوبة العجلة (10 دقائق مستشفى)'],
            ],
        ],
        'awesome' => [
            'id' => 'awesome',
            'costCash' => 1000000,
            'cooldownSeconds' => 2,
            'nameEn' => 'Wheel of Awesome',
            'nameAr' => 'عجلة العظمة (1,000,000$)',
            'prizes' => [
                ['id' => 'cash_1500000', 'weight' => 2500, 'type' => 'cash', 'amount' => 1500000, 'labelEn' => '$1,500,000 Syndicate Briefcase', 'labelAr' => 'حقيبة 1,500,000$'],
                ['id' => 'cash_4000000', 'weight' => 800, 'type' => 'cash', 'amount' => 4000000, 'labelEn' => '$4,000,000 Sovereign Jackpot', 'labelAr' => 'الجائزة الكبرى 4,000,000$'],
                ['id' => 'item_xanax', 'weight' => 2200, 'type' => 'item', 'itemId' => 'xanax', 'qty' => 1, 'labelEn' => '1x Xanax Pack', 'labelAr' => 'عبوة زاناكس'],
                ['id' => 'item_edvd', 'weight' => 1200, 'type' => 'item', 'itemId' => 'edvd', 'qty' => 1, 'labelEn' => '1x Erotic DVD', 'labelAr' => 'قرص ترفيهي نادر'],
                ['id' => 'points_50', 'weight' => 1500, 'type' => 'points', 'amount' => 50, 'labelEn' => '+50 Syndicate Points', 'labelAr' => '+50 نقطة نقابة'],
                ['id' => 'item_plush_lion', 'weight' => 1000, 'type' => 'item', 'itemId' => 'plush_lion', 'qty' => 2, 'labelEn' => '2x Savanna Lion Plushies', 'labelAr' => 'دميتا أسد السافانا'],
                ['id' => 'hosp_slap', 'weight' => 800, 'type' => 'hosp', 'minutes' => 10, 'labelEn' => 'Bodyguard Uppercut (10m Hospital)', 'labelAr' => 'لكمة الحارس الشخصي (10 دقائق مستشفى)'],
            ],
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const HUNT_MODES = [
        'beginner' => [
            'id' => 'beginner',
            'energy' => 10,
            'fee' => 500,
            'minSkill' => 0,
            'cashMin' => 2200,
            'cashMax' => 4800,
            'xp' => 24,
            'trophies' => ['plush_camel', 'plush_bear'],
            'nameEn' => 'Harbor Marsh Tracking',
            'nameAr' => 'صيد مستنقعات المرفأ',
        ],
        'standard' => [
            'id' => 'standard',
            'energy' => 15,
            'fee' => 2000,
            'minSkill' => 0,
            'cashMin' => 6500,
            'cashMax' => 13500,
            'xp' => 45,
            'trophies' => ['plush_moose', 'plush_falcon', 'plush_jaguar'],
            'nameEn' => 'Desert Wadis Safari',
            'nameAr' => 'رحلة سفاري الأودية',
        ],
        'master' => [
            'id' => 'master',
            'energy' => 25,
            'fee' => 5000,
            'minSkill' => 50,
            'cashMin' => 20000,
            'cashMax' => 42000,
            'xp' => 90,
            'trophies' => ['plush_lion', 'plush_falcon', 'plush_pharaoh'],
            'nameEn' => 'Apex Big-Game Expedition',
            'nameAr' => 'رحلة الصيد الكبرى للمحترفين',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const CARS = [
        'civic_e' => [
            'id' => 'civic_e',
            'class' => 'E',
            'price' => 18000,
            'topSpeed' => 48,
            'accel' => 46,
            'handling' => 52,
            'nameEn' => '94 Hatch Civic Si',
            'nameAr' => 'سيفيك هاتش الرياضية (فئة E)',
        ],
        'silvia_d' => [
            'id' => 'silvia_d',
            'class' => 'D',
            'price' => 55000,
            'topSpeed' => 60,
            'accel' => 58,
            'handling' => 64,
            'nameEn' => 'S15 Harbor Drift Silvia',
            'nameAr' => 'سيلفيا درفت المرفأ (فئة D)',
        ],
        'evo_c' => [
            'id' => 'evo_c',
            'class' => 'C',
            'price' => 145000,
            'topSpeed' => 72,
            'accel' => 73,
            'handling' => 74,
            'nameEn' => 'Lancer Evo IX Street',
            'nameAr' => 'لانسر إيفو الشوارع (فئة C)',
        ],
        'gtr_b' => [
            'id' => 'gtr_b',
            'class' => 'B',
            'price' => 380000,
            'topSpeed' => 84,
            'accel' => 86,
            'handling' => 82,
            'nameEn' => 'Skyline GT-R Nismo',
            'nameAr' => 'سكاي لاين جي تي آر (فئة B)',
        ],
        'gt3_a' => [
            'id' => 'gt3_a',
            'class' => 'A',
            'price' => 950000,
            'topSpeed' => 93,
            'accel' => 92,
            'handling' => 94,
            'nameEn' => '911 GT3 RS Weissach',
            'nameAr' => 'بورش جي تي 3 آر إس (فئة A)',
        ],
        'valkyrie_s' => [
            'id' => 'valkyrie_s',
            'class' => 'A',
            'subClass' => 'S-Apex',
            'price' => 2400000,
            'topSpeed' => 99,
            'accel' => 99,
            'handling' => 98,
            'nameEn' => 'Sovereign Valkyrie AMR',
            'nameAr' => 'فالكيري السيادية الخارقة (فئة A+)',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const CAR_UPGRADES = [
        'turbo' => [
            'id' => 'turbo',
            'costPoints' => 5,
            'maxStage' => 3,
            'topSpeed' => 6,
            'accel' => 5,
            'handling' => 1,
            'nameEn' => 'Twin-Scroll Turbocharger',
            'nameAr' => 'شاحن توربيني مزدوج',
        ],
        'ecu' => [
            'id' => 'ecu',
            'costPoints' => 4,
            'maxStage' => 3,
            'topSpeed' => 4,
            'accel' => 5,
            'handling' => 3,
            'nameEn' => 'Motorsport Standalone ECU',
            'nameAr' => 'وحدة تحكم محرك رياضية',
        ],
        'tires' => [
            'id' => 'tires',
            'costPoints' => 3,
            'maxStage' => 3,
            'topSpeed' => 1,
            'accel' => 3,
            'handling' => 7,
            'nameEn' => 'Semi-Slick Racing Tires',
            'nameAr' => 'إطارات سباق عالية التماسك',
        ],
        'suspension' => [
            'id' => 'suspension',
            'costPoints' => 4,
            'maxStage' => 3,
            'topSpeed' => 2,
            'accel' => 2,
            'handling' => 6,
            'nameEn' => 'Coilover Track Suspension',
            'nameAr' => 'نظام تعليق حلبات احترافي',
        ],
        'weight_reduction' => [
            'id' => 'weight_reduction',
            'costPoints' => 5,
            'maxStage' => 3,
            'topSpeed' => 4,
            'accel' => 5,
            'handling' => 4,
            'nameEn' => 'Carbon Chassis Weight Strip',
            'nameAr' => 'تخفيف وزن الهيكل بالكربون',
        ],
    ];

    /** @var array<string, array<string, mixed>> */
    public const TRACKS = [
        'docks_sprint' => [
            'id' => 'docks_sprint',
            'nameEn' => 'Docks Sprint',
            'nameAr' => 'سباق الأرصفة السريع',
            'laps' => 3,
            'recommendedClass' => 'E',
            'rivalRating' => 46,
            'basePurse' => 12000,
            'xp' => 25,
        ],
        'corniche_circuit' => [
            'id' => 'corniche_circuit',
            'nameEn' => 'Corniche Circuit',
            'nameAr' => 'حلبة الكورنيش البحري',
            'laps' => 4,
            'recommendedClass' => 'D',
            'rivalRating' => 58,
            'basePurse' => 24000,
            'xp' => 35,
        ],
        'industrial_drift' => [
            'id' => 'industrial_drift',
            'nameEn' => 'Industrial Drift',
            'nameAr' => 'درفت المنطقة الصناعية',
            'laps' => 4,
            'recommendedClass' => 'C',
            'rivalRating' => 70,
            'basePurse' => 42000,
            'xp' => 50,
        ],
        'airport_runway' => [
            'id' => 'airport_runway',
            'nameEn' => 'Airport Runway',
            'nameAr' => 'مدرج المطار الدولي',
            'laps' => 3,
            'recommendedClass' => 'B',
            'rivalRating' => 81,
            'basePurse' => 68000,
            'xp' => 70,
        ],
        'mountain_pass' => [
            'id' => 'mountain_pass',
            'nameEn' => 'Mountain Pass',
            'nameAr' => 'ممر الجبل الوعر',
            'laps' => 5,
            'recommendedClass' => 'A',
            'rivalRating' => 89,
            'basePurse' => 105000,
            'xp' => 95,
        ],
        'zone_gp' => [
            'id' => 'zone_gp',
            'nameEn' => 'Zone GP',
            'nameAr' => 'جائزة الزون الكبرى',
            'laps' => 6,
            'recommendedClass' => 'A',
            'rivalRating' => 93,
            'basePurse' => 175000,
            'xp' => 130,
        ],
    ];

    private const RIVAL_DRIVERS = [
        'K1ng', 'NadiaQuick', 'Duke_X', 'Rayan_Black', 'Lady_Vega', 'Silas', 'Omar_Z',
    ];

    private readonly Ledger $ledger;
    private readonly NotificationService $notifications;
    private readonly ResourceService $resources;
    private readonly LevelingService $leveling;
    private readonly DailyService $daily;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $clock = null,
        private readonly ?Closure $random = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->notifications = new NotificationService($database);
        $this->resources = new ResourceService($database, $this->notifications);
        $this->leveling = new LevelingService($database, $this->ledger, $events);
        $this->daily = new DailyService($database, $this->ledger, $events, $this->leveling, $clock);
    }

    public function snapshot(string $playerId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            $player = $this->requirePlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $changed = $this->ensureActivityState($playerId, $player, $state);
            if ($changed) {
                $this->saveProgression($playerId, $state, $version + 1);
            }
            return $this->buildSnapshotPayload($playerId, $this->requirePlayer($playerId), $state);
        });
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = trim($action);
        if ($cleanAction === '') {
            throw new InvalidArgumentException('Activity action is required.');
        }

        // Actions allowed while hospitalized or in debt recovery vs active field actions
        if (!in_array($cleanAction, ['loan.repay', 'agent.accept', 'agent.complete', 'agent.claim', 'agent.buyReward', 'race.buyCar', 'race.upgradeCar', 'race.selectCar', 'daily.claimBonus', 'daily.claimWeekly'], true)) {
            (new TravelService($this->database, $this->events, $this->clock))->assertAvailable($playerId);
            (new ProgressionService($this->database, $this->events))->assertAvailable($playerId, $cleanAction);
        }

        if ($cleanAction === 'daily.claimBonus') {
            $cid = bin2hex(random_bytes(16));
            $receipt = $this->daily->claimBonusContract($playerId, $cid);
            return ['action' => $cleanAction, 'result' => $receipt, ...$this->snapshot($playerId)];
        }
        if ($cleanAction === 'daily.claimWeekly') {
            $cid = bin2hex(random_bytes(16));
            $contractId = trim((string) ($payload['contractId'] ?? $payload['id'] ?? ''));
            $receipt = $this->daily->claimWeeklyMilestone($playerId, $contractId, $cid);
            return ['action' => $cleanAction, 'result' => $receipt, ...$this->snapshot($playerId)];
        }

        $receipt = $this->database->playerTransaction($playerId, function () use ($playerId, $cleanAction, $payload): array {
            $this->resources->regenerate($playerId);
            $player = $this->requirePlayer($playerId);
            [$state, $version] = $this->loadProgression($playerId);
            $this->ensureActivityState($playerId, $player, $state);
            $correlationId = bin2hex(random_bytes(16));

            $playerLevel = (int) $player['level'];
            if (in_array($cleanAction, ['dump.toss', 'dump.search'], true)) {
                TornSystemsService::assertLevelUnlocked($playerLevel, 2, 'City Dump');
            } elseif ($cleanAction === 'wheel.spin') {
                TornSystemsService::assertLevelUnlocked($playerLevel, 3, 'Daily Spin Wheels');
            } elseif (in_array($cleanAction, ['agent.accept', 'agent.complete', 'agent.claim'], true)) {
                TornSystemsService::assertLevelUnlocked($playerLevel, 7, 'NPC Fixer Contracts');
            }

            $result = match ($cleanAction) {
                'agent.accept' => $this->acceptAgentContract($playerId, $state, $payload, $correlationId),
                'agent.complete', 'agent.claim' => $this->completeAgentContract($playerId, $player, $state, $payload, $correlationId),
                'agent.refresh' => $this->refreshAgentContracts($playerId, $player, $state, $correlationId),
                'agent.buyReward' => $this->buyMissionReward($playerId, $player, $state, $payload, $correlationId),
                'dump.toss' => $this->tossIntoDump($playerId, $player, $state, $payload, $correlationId),
                'dump.search' => $this->searchDump($playerId, $player, $state, $correlationId),
                'loan.borrow' => $this->borrowLoan($playerId, $player, $state, $payload, $correlationId),
                'loan.repay' => $this->repayLoan($playerId, $player, $state, $payload, $correlationId),
                'wheel.spin' => $this->spinWheel($playerId, $player, $state, $payload, $correlationId),
                'hunt.expedition' => $this->runHuntingExpedition($playerId, $player, $state, $payload, $correlationId),
                'race.buyCar' => $this->buyRaceCar($playerId, $player, $state, $payload, $correlationId),
                'race.selectCar' => $this->selectRaceCar($state, $payload),
                'race.upgradeCar' => $this->upgradeRaceCar($playerId, $state, $payload, $correlationId),
                'race.enterTrack' => $this->enterRaceTrack($playerId, $player, $state, $payload, $correlationId),
                default => throw new InvalidArgumentException("Unsupported city activity action: {$cleanAction}"),
            };

            $this->saveProgression($playerId, $state, $version + 1);
            return $result;
        });

        return [
            'action' => $cleanAction,
            'result' => $receipt,
            ...$this->snapshot($playerId),
        ];
    }

    // ------------------------------------------------------------------
    // 1. NPC Mission Agents & Mission Armory
    // ------------------------------------------------------------------

    private function acceptAgentContract(string $playerId, array &$state, array $payload, string $correlationId): array
    {
        $contracts = &$state['cityActivities']['missionAgents']['contracts'];
        $idx = $this->findContractIndex($contracts, $payload);
        $contract = &$contracts[$idx];
        if (($contract['status'] ?? '') === 'completed') {
            throw new RuntimeException('This mission contract has already been completed.');
        }
        if (($contract['status'] ?? '') === 'accepted') {
            return ['contractId' => $contract['id'], 'status' => 'accepted', 'alreadyAccepted' => true];
        }

        $metrics = $this->livePlayerMetrics($playerId, $state);
        $metricKey = (string) $contract['metric'];
        $contract['status'] = 'accepted';
        $contract['accepted'] = true;
        $contract['baseline'] = (int) ($metrics[$metricKey] ?? 0);
        $contract['acceptedAt'] = gmdate('c', $this->now());

        $this->events->publish(new DomainEvent('MissionContractAccepted', [
            'playerId' => $playerId,
            'contractId' => $contract['id'],
            'agentId' => $contract['agentId'],
            'tier' => $contract['tier'],
            'correlationId' => $correlationId,
        ]));

        return [
            'contractId' => $contract['id'],
            'agentId' => $contract['agentId'],
            'tier' => $contract['tier'],
            'status' => 'accepted',
            'baseline' => $contract['baseline'],
            'target' => $contract['target'],
        ];
    }

    private function completeAgentContract(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $contracts = &$state['cityActivities']['missionAgents']['contracts'];
        $idx = $this->findContractIndex($contracts, $payload);
        $contract = &$contracts[$idx];

        if (($contract['status'] ?? '') === 'completed') {
            throw new RuntimeException('Mission contract already claimed.');
        }
        if (($contract['status'] ?? '') !== 'accepted') {
            throw new RuntimeException('Accept the mission contract before claiming completion.');
        }

        $metrics = $this->livePlayerMetrics($playerId, $state);
        $currentVal = (int) ($metrics[$contract['metric']] ?? 0);
        $progress = max(0, $currentVal - (int) ($contract['baseline'] ?? 0));
        $target = (int) $contract['target'];
        if ($progress < $target) {
            throw new RuntimeException(sprintf('Mission incomplete (%d/%d %s).', $progress, $target, $contract['metric']));
        }

        $rewardCash = (int) $contract['rewardCash'];
        $rewardXp = (int) $contract['rewardXp'];
        $rewardCredits = max(15, min(75, (int) $contract['missionCredits']));

        $newCash = (int) $player['cash'] + $rewardCash;
        $newXp = (int) $player['xp'] + $rewardXp;
        $this->database->execute(
            'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
            ['cash' => $newCash, 'xp' => $newXp, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', $rewardCash, $newCash, 'mission.agent.reward', $correlationId);

        $state['missionCredits'] = max(0, (int) ($state['missionCredits'] ?? 0)) + $rewardCredits;
        $this->ledger->record($playerId, 'mission_credits', $rewardCredits, (int) $state['missionCredits'], 'mission.agent.credits', $correlationId);

        $contract['status'] = 'completed';
        $contract['completed'] = true;
        $contract['completedAt'] = gmdate('c', $this->now());
        $state['cityActivities']['missionAgents']['completedCount'] = (int) ($state['cityActivities']['missionAgents']['completedCount'] ?? 0) + 1;

        $levelUp = $this->leveling->sync($playerId, $correlationId);

        $this->events->publish(new DomainEvent('MissionContractCompleted', [
            'playerId' => $playerId,
            'contractId' => $contract['id'],
            'agentId' => $contract['agentId'],
            'tier' => $contract['tier'],
            'rewardCash' => $rewardCash,
            'rewardXp' => $rewardXp,
            'missionCredits' => $rewardCredits,
            'correlationId' => $correlationId,
        ]));

        return [
            'contractId' => $contract['id'],
            'agentId' => $contract['agentId'],
            'tier' => $contract['tier'],
            'rewardCash' => $rewardCash,
            'rewardXp' => $rewardXp,
            'missionCreditsAwarded' => $rewardCredits,
            'missionCreditsBalance' => (int) $state['missionCredits'],
            'levelUp' => $levelUp,
        ];
    }

    private function refreshAgentContracts(string $playerId, array $player, array &$state, string $correlationId): array
    {
        if ((int) $player['energy'] < 10) {
            throw new RuntimeException('Need 10 Energy to refresh NPC Mission Agent contracts.');
        }
        $this->database->execute('UPDATE players SET energy = energy - 10 WHERE id = :id', ['id' => $playerId]);
        $metrics = $this->livePlayerMetrics($playerId, $state);
        $state['cityActivities']['missionAgents']['contracts'] = $this->generateThreeContracts((int) $player['level'], $metrics);
        $state['cityActivities']['missionAgents']['refreshes'] = (int) ($state['cityActivities']['missionAgents']['refreshes'] ?? 0) + 1;

        $this->events->publish(new DomainEvent('MissionContractsRefreshed', [
            'playerId' => $playerId,
            'energySpent' => 10,
            'correlationId' => $correlationId,
        ]));

        return [
            'energySpent' => 10,
            'contractsGenerated' => 3,
        ];
    }

    private function buyMissionReward(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $rawId = strtolower(trim((string) ($payload['rewardId'] ?? $payload['itemId'] ?? $payload['id'] ?? '')));
        if ($rawId === 'xp_book' || $rawId === 'book' || str_contains($rawId, 'skill')) {
            $rawId = 'skill_xp_book';
        }
        $offer = self::MISSION_ARMORY[$rawId] ?? null;
        if ($offer === null) {
            throw new InvalidArgumentException("Unknown Mission Armory reward: {$rawId}");
        }

        $cost = (int) $offer['costCredits'];
        $balance = max(0, (int) ($state['missionCredits'] ?? 0));
        if ($balance < $cost) {
            throw new RuntimeException("Need {$cost} Mission Credits (you have {$balance}).");
        }

        $state['missionCredits'] = $balance - $cost;
        $this->ledger->record($playerId, 'mission_credits', -$cost, (int) $state['missionCredits'], 'mission.armory.buy', $correlationId);

        if ($offer['kind'] === 'skill_book') {
            $skillKey = strtolower(trim((string) ($payload['skill'] ?? 'hunting')));
            $allowedSkills = ['hunting', 'racing', 'reviving', 'busting', 'smuggling', 'forging', 'hacking', 'weapon_mastery', 'crime_mastery'];
            if (!in_array($skillKey, $allowedSkills, true)) {
                $skillKey = 'hunting';
            }
            $state['skill'] = is_array($state['skill'] ?? null) ? $state['skill'] : [];
            $prevSkill = max(0, min(100, (int) ($state['skill'][$skillKey] ?? 0)));
            $state['skill'][$skillKey] = min(100, $prevSkill + (int) $offer['skillBonus']);
            $state['crimeXp'] = (int) ($state['crimeXp'] ?? 0) + 25;
            $state['gymXp'] = (int) ($state['gymXp'] ?? 0) + 25;

            $newXp = (int) $player['xp'] + (int) $offer['xpBonus'];
            $this->database->execute('UPDATE players SET xp = :xp WHERE id = :id', ['xp' => $newXp, 'id' => $playerId]);
            $levelUp = $this->leveling->sync($playerId, $correlationId);

            return [
                'rewardId' => $rawId,
                'creditsSpent' => $cost,
                'missionCreditsBalance' => (int) $state['missionCredits'],
                'skillTrained' => $skillKey,
                'skillLevel' => $state['skill'][$skillKey],
                'xpAwarded' => (int) $offer['xpBonus'],
                'levelUp' => $levelUp,
            ];
        }

        $itemId = (string) $offer['itemId'];
        $qty = max(1, (int) $offer['quantity']);
        $this->assertCatalogItem($itemId);
        $state['inv'][$itemId] = max(0, (int) ($state['inv'][$itemId] ?? 0)) + $qty;
        $this->ledger->record($playerId, 'item:' . $itemId, $qty, (int) $state['inv'][$itemId], 'mission.armory.item', $correlationId);

        $this->events->publish(new DomainEvent('MissionArmoryPurchased', [
            'playerId' => $playerId,
            'rewardId' => $rawId,
            'itemId' => $itemId,
            'quantity' => $qty,
            'creditsSpent' => $cost,
            'correlationId' => $correlationId,
        ]));

        return [
            'rewardId' => $rawId,
            'itemId' => $itemId,
            'quantity' => $qty,
            'creditsSpent' => $cost,
            'missionCreditsBalance' => (int) $state['missionCredits'],
        ];
    }

    // ------------------------------------------------------------------
    // 2. City Dump (`dump.toss`, `dump.search`)
    // ------------------------------------------------------------------

    private function tossIntoDump(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $itemId = trim((string) ($payload['itemId'] ?? $payload['id'] ?? ''));
        $quantity = $this->parseBoundedInt($payload['quantity'] ?? $payload['qty'] ?? 1, 1, 100, 'quantity');
        $itemDef = $this->assertCatalogItem($itemId);

        $owned = (int) ($state['inv'][$itemId] ?? 0);
        if ($owned < $quantity) {
            throw new RuntimeException("You do not own {$quantity}x {$itemId} to toss into the City Dump.");
        }

        $state['inv'][$itemId] = $owned - $quantity;
        LoadoutService::removeMissing($state, $itemId);
        $this->ledger->record($playerId, 'item:' . $itemId, -$quantity, (int) $state['inv'][$itemId], 'dump.toss', $correlationId);

        $this->lockMetaKey(self::DUMP_META_KEY, '{"items":[]}');
        $dumpPool = $this->loadDumpPool();
        $merged = false;
        foreach ($dumpPool['items'] as &$entry) {
            if (($entry['itemId'] ?? '') === $itemId && ($entry['tossedById'] ?? '') === $playerId) {
                $entry['qty'] = (int) $entry['qty'] + $quantity;
                $entry['at'] = gmdate('c', $this->now());
                $merged = true;
                break;
            }
        }
        unset($entry);
        if (!$merged) {
            $dumpPool['items'][] = [
                'itemId' => $itemId,
                'qty' => $quantity,
                'tossedBy' => (string) $player['username'],
                'tossedById' => $playerId,
                'playerTossed' => true,
                'at' => gmdate('c', $this->now()),
            ];
        }
        $dumpPool['totalTossed'] = (int) ($dumpPool['totalTossed'] ?? 0) + $quantity;
        $this->saveDumpPool($dumpPool);

        $state['cityActivities']['dump']['tossedCount'] = (int) ($state['cityActivities']['dump']['tossedCount'] ?? 0) + $quantity;
        $firstTimeHonorAwarded = false;
        $state['claimedHonors'] = is_array($state['claimedHonors'] ?? null) ? $state['claimedHonors'] : [];
        if (empty($state['claimedHonors']['dump_tosser'])) {
            $state['claimedHonors']['dump_tosser'] = 1;
            $state['cityActivities']['dump']['firstTossHonor'] = true;
            $state['merits'] = max(0, (int) ($state['merits'] ?? 0)) + 1;
            $this->ledger->record($playerId, 'merits', 1, (int) $state['merits'], 'honor.dump_tosser', $correlationId);
            $firstTimeHonorAwarded = true;
        }
        if (((int) ($itemDef['price'] ?? 0)) >= 25000 && empty($state['claimedHonors']['dump_benefactor'])) {
            $state['claimedHonors']['dump_benefactor'] = 1;
            $state['merits'] = max(0, (int) ($state['merits'] ?? 0)) + 1;
            $this->ledger->record($playerId, 'merits', 1, (int) $state['merits'], 'honor.dump_benefactor', $correlationId);
        }

        $this->events->publish(new DomainEvent('CityDumpTossed', [
            'playerId' => $playerId,
            'itemId' => $itemId,
            'quantity' => $quantity,
            'firstTimeHonorAwarded' => $firstTimeHonorAwarded,
            'correlationId' => $correlationId,
        ]));

        return [
            'itemId' => $itemId,
            'quantity' => $quantity,
            'firstTimeHonorAwarded' => $firstTimeHonorAwarded,
            'dumpHonorUnlocked' => !empty($state['claimedHonors']['dump_tosser']),
            'poolTotalUnits' => $this->countDumpUnits($dumpPool),
        ];
    }

    private function searchDump(string $playerId, array $player, array &$state, string $correlationId): array
    {
        if ((int) $player['energy'] < 5) {
            throw new RuntimeException('Need 5 Energy to search the City Dump.');
        }
        $this->database->execute('UPDATE players SET energy = energy - 5 WHERE id = :id', ['id' => $playerId]);

        $this->lockMetaKey(self::DUMP_META_KEY, '{"items":[]}');
        $dumpPool = $this->loadDumpPool();
        if ($this->countDumpUnits($dumpPool) < 1) {
            $dumpPool = $this->defaultDumpPool();
        }

        $availableIndices = [];
        $totalWeight = 0;
        foreach ($dumpPool['items'] as $idx => $entry) {
            $qty = max(0, (int) ($entry['qty'] ?? 0));
            if ($qty > 0) {
                // Slightly boost player-tossed treasures so tossed items are discoverable!
                $weight = $qty * (!empty($entry['playerTossed']) ? 3 : 1);
                $availableIndices[] = [$idx, $weight];
                $totalWeight += $weight;
            }
        }

        $roll = $this->roll(1, max(1, $totalWeight));
        $chosenIdx = $availableIndices[0][0];
        $cursor = 0;
        foreach ($availableIndices as [$idx, $weight]) {
            $cursor += $weight;
            if ($roll <= $cursor) {
                $chosenIdx = $idx;
                break;
            }
        }

        $foundEntry = $dumpPool['items'][$chosenIdx];
        $foundItemId = (string) $foundEntry['itemId'];
        $tossedBy = (string) ($foundEntry['tossedBy'] ?? 'Municipal Sanitation');
        $dumpPool['items'][$chosenIdx]['qty'] = max(0, (int) $foundEntry['qty'] - 1);
        $dumpPool['items'] = array_values(array_filter(
            $dumpPool['items'],
            static fn (array $e): bool => (int) ($e['qty'] ?? 0) > 0,
        ));
        $dumpPool['totalSearched'] = (int) ($dumpPool['totalSearched'] ?? 0) + 1;
        $this->saveDumpPool($dumpPool);

        $this->assertCatalogItem($foundItemId);
        $state['inv'][$foundItemId] = max(0, (int) ($state['inv'][$foundItemId] ?? 0)) + 1;
        $this->ledger->record($playerId, 'item:' . $foundItemId, 1, (int) $state['inv'][$foundItemId], 'dump.search', $correlationId);

        $state['cityActivities']['dump']['searchCount'] = (int) ($state['cityActivities']['dump']['searchCount'] ?? 0) + 1;
        $state['cityActivities']['dump']['lastFound'] = [
            'itemId' => $foundItemId,
            'tossedBy' => $tossedBy,
            'at' => gmdate('c', $this->now()),
        ];

        $this->daily->recordProgress($playerId, 'dump_searches', 1);

        $this->events->publish(new DomainEvent('CityDumpSearched', [
            'playerId' => $playerId,
            'foundItemId' => $foundItemId,
            'tossedBy' => $tossedBy,
            'energySpent' => 5,
            'correlationId' => $correlationId,
        ]));

        return [
            'energySpent' => 5,
            'foundItemId' => $foundItemId,
            'foundItem' => $foundItemId,
            'itemId' => $foundItemId,
            'quantity' => 1,
            'tossedBy' => $tossedBy,
            'poolRemainingUnits' => $this->countDumpUnits($dumpPool),
            'messageEn' => "Scavenged 1x {$foundItemId} from the City Dump",
            'messageAr' => "عثرت على 1x {$foundItemId} في مكب المدينة",
        ];
    }

    // ------------------------------------------------------------------
    // 3. Duke's Loan Shark (`loan.borrow`, `loan.repay`)
    // ------------------------------------------------------------------

    public static function maxLoanForLevel(int $level): int
    {
        return min(25_000_000, max(25_000, 25_000 * max(1, $level)));
    }

    private function borrowLoan(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $loan = &$state['cityActivities']['loan'];
        $this->accrueLoanState($loan);

        if (!empty($loan['dukeEnforcerHeat'])) {
            throw new RuntimeException("Duke's enforcers have you flagged overdue (>72h). Repay your active loan first.");
        }

        $amount = $this->parseBoundedInt($payload['amount'] ?? 0, 1000, 25_000_000, 'loan amount');
        $maxLoan = self::maxLoanForLevel((int) $player['level']);
        $currentPrincipal = max(0, (int) ($loan['principal'] ?? 0));
        if ($currentPrincipal + $amount > $maxLoan) {
            throw new RuntimeException(sprintf(
                'Loan exceeds Duke credit cap of $%s for Level %d (available: $%s).',
                number_format($maxLoan),
                (int) $player['level'],
                number_format(max(0, $maxLoan - $currentPrincipal)),
            ));
        }

        $originationFee = (int) ceil($amount * self::LOAN_VIGORISH_BPS / 10000);
        $now = $this->now();

        $newCash = (int) $player['cash'] + $amount;
        $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
        $this->ledger->record($playerId, 'cash', $amount, $newCash, 'loan.borrow', $correlationId);

        $loan['principal'] = $currentPrincipal + $amount;
        $loan['vigorishOwed'] = max(0, (int) ($loan['vigorishOwed'] ?? 0)) + $originationFee;
        $loan['borrowedAt'] = $loan['borrowedAt'] ?? $now;
        $loan['dueAt'] = (int) $loan['borrowedAt'] + self::LOAN_OVERDUE_SECONDS;
        $loan['lastAccruedAt'] = $now;
        $loan['dukeEnforcerHeat'] = false;

        $this->events->publish(new DomainEvent('DukeLoanBorrowed', [
            'playerId' => $playerId,
            'amount' => $amount,
            'originationFee' => $originationFee,
            'principal' => $loan['principal'],
            'totalOwed' => $loan['principal'] + $loan['vigorishOwed'],
            'correlationId' => $correlationId,
        ]));

        return [
            'borrowed' => $amount,
            'originationVigorish' => $originationFee,
            'principal' => $loan['principal'],
            'vigorishOwed' => $loan['vigorishOwed'],
            'totalOwed' => $loan['principal'] + $loan['vigorishOwed'],
            'dueAt' => gmdate('c', (int) $loan['dueAt']),
            'dukeEnforcerHeat' => false,
        ];
    }

    private function repayLoan(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $loan = &$state['cityActivities']['loan'];
        $this->accrueLoanState($loan);

        $principal = max(0, (int) ($loan['principal'] ?? 0));
        $vigorish = max(0, (int) ($loan['vigorishOwed'] ?? 0));
        $totalOwed = $principal + $vigorish;
        if ($totalOwed <= 0) {
            throw new RuntimeException('You have no active debt with Duke.');
        }

        $requested = isset($payload['amount']) && $payload['amount'] !== '' && $payload['amount'] !== null
            ? $this->parseBoundedInt($payload['amount'], 1, 100_000_000, 'repay amount')
            : $totalOwed;
        $pay = min($requested, $totalOwed);

        if ((int) $player['cash'] < $pay) {
            throw new RuntimeException('Not enough cash on hand to repay Duke.');
        }

        $newCash = (int) $player['cash'] - $pay;
        $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
        $this->ledger->record($playerId, 'cash', -$pay, $newCash, 'loan.repay', $correlationId);

        $principalCleared = min($principal, $pay);
        $vigorishCleared = $pay - $principalCleared;
        $loan['principal'] = $principal - $principalCleared;
        $loan['vigorishOwed'] = max(0, $vigorish - $vigorishCleared);

        if ($loan['principal'] === 0 && $loan['vigorishOwed'] === 0) {
            $loan['borrowedAt'] = null;
            $loan['dueAt'] = null;
            $loan['lastAccruedAt'] = null;
            $loan['dukeEnforcerHeat'] = false;
        } elseif ($loan['principal'] === 0) {
            $loan['dukeEnforcerHeat'] = false;
        }

        $this->events->publish(new DomainEvent('DukeLoanRepaid', [
            'playerId' => $playerId,
            'paid' => $pay,
            'principalRemaining' => $loan['principal'],
            'vigorishRemaining' => $loan['vigorishOwed'],
            'dukeEnforcerHeat' => (bool) $loan['dukeEnforcerHeat'],
            'correlationId' => $correlationId,
        ]));

        return [
            'paid' => $pay,
            'principalCleared' => $principalCleared,
            'vigorishCleared' => $vigorishCleared,
            'principalRemaining' => $loan['principal'],
            'vigorishRemaining' => $loan['vigorishOwed'],
            'totalOwed' => $loan['principal'] + $loan['vigorishOwed'],
            'dukeEnforcerHeat' => (bool) $loan['dukeEnforcerHeat'],
        ];
    }

    private function accrueLoanState(array &$loan): bool
    {
        $changed = false;
        $principal = max(0, (int) ($loan['principal'] ?? 0));
        $vigorish = max(0, (int) ($loan['vigorishOwed'] ?? 0));
        if ($principal <= 0 && $vigorish <= 0) {
            if (!empty($loan['dukeEnforcerHeat'])) {
                $loan['dukeEnforcerHeat'] = false;
                $changed = true;
            }
            return $changed;
        }

        $now = $this->now();
        $lastAccrued = isset($loan['lastAccruedAt']) && $loan['lastAccruedAt'] !== null ? (int) $loan['lastAccruedAt'] : $now;
        $daysElapsed = intdiv(max(0, $now - $lastAccrued), 86400);
        if ($daysElapsed > 0 && $principal > 0) {
            $addedVig = (int) ceil($principal * (self::LOAN_VIGORISH_BPS / 10000) * min(30, $daysElapsed));
            $loan['vigorishOwed'] = $vigorish + $addedVig;
            $loan['lastAccruedAt'] = $lastAccrued + ($daysElapsed * 86400);
            $changed = true;
        }

        $borrowedAt = isset($loan['borrowedAt']) && $loan['borrowedAt'] !== null ? (int) $loan['borrowedAt'] : $now;
        $overdue = $principal > 0 && ($now - $borrowedAt) > self::LOAN_OVERDUE_SECONDS;
        if (($loan['dukeEnforcerHeat'] ?? false) !== $overdue) {
            $loan['dukeEnforcerHeat'] = $overdue;
            $changed = true;
        }
        return $changed;
    }

    // ------------------------------------------------------------------
    // 4. 3 Torn Spin Wheels (`wheel.spin`)
    // ------------------------------------------------------------------

    private function spinWheel(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $wheelId = strtolower(trim((string) ($payload['wheelId'] ?? $payload['wheel'] ?? $payload['tier'] ?? $payload['id'] ?? 'lame')));
        $wheel = self::SPIN_WHEELS[$wheelId] ?? null;
        if ($wheel === null) {
            throw new InvalidArgumentException("Unknown spin wheel: {$wheelId}");
        }

        $now = $this->now();
        $today = gmdate('Y-m-d', $now);
        $wheelState = &$state['cityActivities']['wheels'][$wheelId];
        $cooldownUntil = (int) ($wheelState['cooldownUntil'] ?? 0);
        if ($cooldownUntil > $now) {
            $rem = $cooldownUntil - $now;
            throw new RuntimeException("Wheel of {$wheelId} is still spinning down ({$rem}s remaining).");
        }

        $cost = (int) $wheel['costCash'];
        if ((int) $player['cash'] < $cost) {
            throw new RuntimeException("Need $" . number_format($cost) . " cash to spin the {$wheel['nameEn']}.");
        }

        $cashAfterFee = (int) $player['cash'] - $cost;
        $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $cashAfterFee, 'id' => $playerId]);
        $this->ledger->record($playerId, 'cash', -$cost, $cashAfterFee, 'wheel.spin.' . $wheelId, $correlationId);

        $totalWeight = array_sum(array_column($wheel['prizes'], 'weight'));
        $roll = $this->roll(1, $totalWeight);
        $cursor = 0;
        $wonPrize = $wheel['prizes'][0];
        foreach ($wheel['prizes'] as $prize) {
            $cursor += (int) $prize['weight'];
            if ($roll <= $cursor) {
                $wonPrize = $prize;
                break;
            }
        }

        $prizeReceipt = [
            'wheelId' => $wheelId,
            'costCash' => $cost,
            'prizeId' => $wonPrize['id'],
            'prizeType' => $wonPrize['type'],
            'prizeLabel' => $wonPrize['labelEn'],
            'labelEn' => $wonPrize['labelEn'],
            'labelAr' => $wonPrize['labelAr'],
            'messageEn' => $wonPrize['labelEn'],
            'messageAr' => $wonPrize['labelAr'],
            'hospitalized' => $wonPrize['type'] === 'hosp',
            'cashWon' => 0,
            'pointsWon' => 0,
            'itemWon' => null,
            'hospitalMinutes' => 0,
        ];

        if ($wonPrize['type'] === 'cash') {
            $winCash = (int) $wonPrize['amount'];
            $finalCash = $cashAfterFee + $winCash;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $finalCash, 'id' => $playerId]);
            $this->ledger->record($playerId, 'cash', $winCash, $finalCash, 'wheel.prize.' . $wheelId, $correlationId);
            $prizeReceipt['cashWon'] = $winCash;
        } elseif ($wonPrize['type'] === 'points') {
            $pts = (int) $wonPrize['amount'];
            $state['points'] = max(0, (int) ($state['points'] ?? 0)) + $pts;
            $this->ledger->record($playerId, 'points', $pts, (int) $state['points'], 'wheel.prize.' . $wheelId, $correlationId);
            $prizeReceipt['pointsWon'] = $pts;
        } elseif ($wonPrize['type'] === 'item') {
            $itemId = (string) $wonPrize['itemId'];
            $qty = max(1, (int) $wonPrize['qty']);
            $this->assertCatalogItem($itemId);
            $state['inv'][$itemId] = max(0, (int) ($state['inv'][$itemId] ?? 0)) + $qty;
            $this->ledger->record($playerId, 'item:' . $itemId, $qty, (int) $state['inv'][$itemId], 'wheel.prize.' . $wheelId, $correlationId);
            $prizeReceipt['itemWon'] = ['itemId' => $itemId, 'quantity' => $qty];
        } elseif ($wonPrize['type'] === 'hosp') {
            $mins = (int) $wonPrize['minutes'];
            $nowMs = $now * 1000;
            $state['hospUntil'] = max((int) ($state['hospUntil'] ?? 0), $nowMs + ($mins * 60_000));
            $prizeReceipt['hospitalMinutes'] = $mins;
        }

        $spinsToday = ($wheelState['lastDay'] ?? '') === $today ? ((int) ($wheelState['spinsToday'] ?? 0) + 1) : 1;
        $wheelState = [
            'lastDay' => $today,
            'spinsToday' => $spinsToday,
            'totalSpins' => (int) ($wheelState['totalSpins'] ?? 0) + 1,
            'cooldownUntil' => $now + (int) $wheel['cooldownSeconds'],
            'lastPrize' => $wonPrize['labelEn'],
        ];

        $this->events->publish(new DomainEvent('WheelSpun', [
            'playerId' => $playerId,
            'wheelId' => $wheelId,
            'costCash' => $cost,
            'prizeId' => $wonPrize['id'],
            'prizeType' => $wonPrize['type'],
            'correlationId' => $correlationId,
        ]));

        return $prizeReceipt;
    }

    // ------------------------------------------------------------------
    // 5. Harbor & Safari Hunting (`hunt.expedition`)
    // ------------------------------------------------------------------

    private function runHuntingExpedition(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $modeId = strtolower(trim((string) ($payload['mode'] ?? $payload['tier'] ?? $payload['id'] ?? 'beginner')));
        $mode = self::HUNT_MODES[$modeId] ?? null;
        if ($mode === null) {
            throw new InvalidArgumentException("Unknown hunting expedition mode: {$modeId}");
        }

        $state['skill'] = is_array($state['skill'] ?? null) ? $state['skill'] : [];
        $huntingSkill = max(0, min(100, (int) ($state['skill']['hunting'] ?? 0)));
        $minSkill = (int) $mode['minSkill'];
        if ($huntingSkill < $minSkill) {
            throw new RuntimeException("Master Safari unlocks at Hunting Skill {$minSkill} (current: {$huntingSkill}).");
        }

        $energyCost = (int) $mode['energy'];
        $fee = (int) $mode['fee'];
        if ((int) $player['energy'] < $energyCost) {
            throw new RuntimeException("Need {$energyCost} Energy for {$mode['nameEn']}.");
        }
        if ((int) $player['cash'] < $fee) {
            throw new RuntimeException("Need $" . number_format($fee) . " license & ammo fee for {$mode['nameEn']}.");
        }

        $cashAfterFee = (int) $player['cash'] - $fee;
        $this->database->execute(
            'UPDATE players SET energy = energy - :energy, cash = :cash WHERE id = :id',
            ['energy' => $energyCost, 'cash' => $cashAfterFee, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', -$fee, $cashAfterFee, 'hunt.fee.' . $modeId, $correlationId);

        $successChanceBps = min(9600, 7000 + ($huntingSkill * 26));
        $cleanKill = $this->roll(1, 10000) <= $successChanceBps;
        $basePayout = $this->roll((int) $mode['cashMin'], (int) $mode['cashMax']);
        $skillMultiplier = 1.0 + ($huntingSkill * 0.018);
        $payout = $cleanKill
            ? (int) round($basePayout * $skillMultiplier)
            : (int) round($basePayout * 0.45);

        $xpGain = $cleanKill ? (int) $mode['xp'] : (int) ceil((int) $mode['xp'] * 0.5);
        $finalCash = $cashAfterFee + $payout;
        $newXp = (int) $player['xp'] + $xpGain;
        $this->database->execute(
            'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
            ['cash' => $finalCash, 'xp' => $newXp, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', $payout, $finalCash, 'hunt.pelt.' . $modeId, $correlationId);

        $trophyDropChanceBps = min(8000, 1800 + ($huntingSkill * 50) + ($modeId === 'master' ? 1800 : ($modeId === 'standard' ? 700 : 0)));
        $trophyItemId = null;
        if ($cleanKill && $this->roll(1, 10000) <= $trophyDropChanceBps) {
            $trophies = $mode['trophies'];
            $trophyItemId = (string) $trophies[$this->roll(0, count($trophies) - 1)];
            $this->assertCatalogItem($trophyItemId);
            $state['inv'][$trophyItemId] = max(0, (int) ($state['inv'][$trophyItemId] ?? 0)) + 1;
            $this->ledger->record($playerId, 'item:' . $trophyItemId, 1, (int) $state['inv'][$trophyItemId], 'hunt.trophy.' . $modeId, $correlationId);
        }

        $skillGain = $this->roll(2, 4);
        $newHuntingSkill = min(100, $huntingSkill + $skillGain);
        $state['skill']['hunting'] = $newHuntingSkill;
        $state['cityActivities']['hunting']['expeditions'] = (int) ($state['cityActivities']['hunting']['expeditions'] ?? 0) + 1;
        $state['cityActivities']['hunting']['totalEarned'] = (int) ($state['cityActivities']['hunting']['totalEarned'] ?? 0) + ($payout - $fee);
        if ($trophyItemId !== null) {
            $state['cityActivities']['hunting']['trophiesFound'] = (int) ($state['cityActivities']['hunting']['trophiesFound'] ?? 0) + 1;
        }

        $levelUp = $this->leveling->sync($playerId, $correlationId);
        $this->daily->recordProgress($playerId, 'hunts', 1);

        $this->events->publish(new DomainEvent('HuntingExpeditionCompleted', [
            'playerId' => $playerId,
            'mode' => $modeId,
            'cleanKill' => $cleanKill,
            'fee' => $fee,
            'payout' => $payout,
            'trophyItemId' => $trophyItemId,
            'huntingSkill' => $newHuntingSkill,
            'correlationId' => $correlationId,
        ]));

        return [
            'mode' => $modeId,
            'cleanKill' => $cleanKill,
            'energySpent' => $energyCost,
            'feePaid' => $fee,
            'grossPayout' => $payout,
            'netProfit' => $payout - $fee,
            'xpAwarded' => $xpGain,
            'trophyItemId' => $trophyItemId,
            'skillGain' => $newHuntingSkill - $huntingSkill,
            'huntingSkill' => $newHuntingSkill,
            'levelUp' => $levelUp,
        ];
    }

    // ------------------------------------------------------------------
    // 6. Garage & 5-Class Street Racing League
    // ------------------------------------------------------------------

    private function buyRaceCar(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $carId = strtolower(trim((string) ($payload['carId'] ?? $payload['id'] ?? '')));
        $car = self::CARS[$carId] ?? null;
        if ($car === null) {
            throw new InvalidArgumentException("Unknown street racing car: {$carId}");
        }

        $garage = &$state['cityActivities']['racing'];
        if (isset($garage['cars'][$carId])) {
            $garage['activeCarId'] = $carId;
            return [
                'carId' => $carId,
                'class' => $car['class'],
                'pricePaid' => 0,
                'activeCarId' => $carId,
                'selected' => true,
                'messageEn' => "Selected {$car['nameEn']}",
                'messageAr' => "تم اختيار {$car['nameAr']}",
            ];
        }

        $price = (int) $car['price'];
        if ((int) $player['cash'] < $price) {
            throw new RuntimeException("Need $" . number_format($price) . " cash to buy the {$car['nameEn']}.");
        }

        $newCash = (int) $player['cash'] - $price;
        $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
        $this->ledger->record($playerId, 'cash', -$price, $newCash, 'race.buy_car.' . $carId, $correlationId);

        $garage['cars'][$carId] = [
            'id' => $carId,
            'upgrades' => [],
            'races' => 0,
            'wins' => 0,
            'podiums' => 0,
            'boughtAt' => gmdate('c', $this->now()),
        ];
        $garage['activeCarId'] = $carId;

        $this->events->publish(new DomainEvent('RaceCarPurchased', [
            'playerId' => $playerId,
            'carId' => $carId,
            'class' => $car['class'],
            'price' => $price,
            'correlationId' => $correlationId,
        ]));

        return [
            'carId' => $carId,
            'class' => $car['class'],
            'pricePaid' => $price,
            'activeCarId' => $carId,
        ];
    }

    private function selectRaceCar(array &$state, array $payload): array
    {
        $carId = strtolower(trim((string) ($payload['carId'] ?? $payload['id'] ?? '')));
        if (!isset($state['cityActivities']['racing']['cars'][$carId])) {
            throw new RuntimeException('You do not own that car in your garage.');
        }
        $state['cityActivities']['racing']['activeCarId'] = $carId;
        return ['activeCarId' => $carId];
    }

    private function upgradeRaceCar(string $playerId, array &$state, array $payload, string $correlationId): array
    {
        $garage = &$state['cityActivities']['racing'];
        $carId = strtolower(trim((string) ($payload['carId'] ?? $garage['activeCarId'] ?? '')));
        if ($carId === '' || !isset($garage['cars'][$carId])) {
            throw new RuntimeException('Purchase and select a garage car before installing tuning upgrades.');
        }

        $upgradeId = strtolower(trim((string) ($payload['upgradeId'] ?? $payload['partId'] ?? $payload['part'] ?? $payload['upgrade'] ?? $payload['id'] ?? '')));
        $part = self::CAR_UPGRADES[$upgradeId] ?? null;
        if ($part === null) {
            throw new InvalidArgumentException("Unknown tuning upgrade part: {$upgradeId}");
        }

        $currentStage = max(0, (int) ($garage['cars'][$carId]['upgrades'][$upgradeId] ?? 0));
        if ($currentStage >= (int) $part['maxStage']) {
            throw new RuntimeException("{$part['nameEn']} is already at maximum Stage {$part['maxStage']} on {$carId}.");
        }

        $costPts = (int) $part['costPoints'];
        $racingPts = max(0, (int) ($state['racingPoints'] ?? 0));
        if ($racingPts < $costPts) {
            throw new RuntimeException("Need {$costPts} Racing Points to install {$part['nameEn']} (available: {$racingPts}).");
        }

        $state['racingPoints'] = $racingPts - $costPts;
        $this->ledger->record($playerId, 'racing_points', -$costPts, (int) $state['racingPoints'], 'race.upgrade.' . $upgradeId, $correlationId);

        $newStage = $currentStage + 1;
        $garage['cars'][$carId]['upgrades'][$upgradeId] = $newStage;

        $this->events->publish(new DomainEvent('RaceCarUpgraded', [
            'playerId' => $playerId,
            'carId' => $carId,
            'upgradeId' => $upgradeId,
            'stage' => $newStage,
            'pointsSpent' => $costPts,
            'correlationId' => $correlationId,
        ]));

        return [
            'carId' => $carId,
            'upgradeId' => $upgradeId,
            'stage' => $newStage,
            'racingPointsSpent' => $costPts,
            'racingPointsBalance' => (int) $state['racingPoints'],
            'effectiveStats' => $this->computeCarStats($carId, $garage['cars'][$carId]['upgrades']),
        ];
    }

    private function enterRaceTrack(string $playerId, array $player, array &$state, array $payload, string $correlationId): array
    {
        $garage = &$state['cityActivities']['racing'];
        $carId = strtolower(trim((string) ($payload['carId'] ?? $garage['activeCarId'] ?? '')));
        if ($carId === '' || !isset($garage['cars'][$carId])) {
            throw new RuntimeException('Buy a car in the Garage before entering a Street Racing League track.');
        }

        $trackId = $this->resolveTrackId((string) ($payload['trackId'] ?? $payload['track'] ?? $payload['id'] ?? 'docks_sprint'));
        $track = self::TRACKS[$trackId];

        if ((int) $player['energy'] < 10) {
            throw new RuntimeException('Need 10 Energy to enter a Street Racing League event.');
        }
        $this->database->execute('UPDATE players SET energy = energy - 10 WHERE id = :id', ['id' => $playerId]);

        $carStats = $this->computeCarStats($carId, $garage['cars'][$carId]['upgrades'] ?? []);
        $state['skill'] = is_array($state['skill'] ?? null) ? $state['skill'] : [];
        $racingSkill = max(0, min(100, (int) ($state['skill']['racing'] ?? 0)));
        $mechBonus = !empty($state['eduDone']['mech']) ? 8.0 : 0.0;

        $playerPerformance = $carStats['rating'] + ($racingSkill * 0.35) + $mechBonus;
        $lapsCount = (int) $track['laps'];
        $baseLapMs = 68000;

        $entrants = [
            [
                'driverId' => $playerId,
                'driverName' => (string) $player['username'],
                'carName' => self::CARS[$carId]['nameEn'],
                'class' => self::CARS[$carId]['class'],
                'isPlayer' => true,
                'rating' => $playerPerformance,
                'totalTimeMs' => 0,
                'lapTimesMs' => [],
            ],
        ];
        foreach (self::RIVAL_DRIVERS as $idx => $rivalName) {
            $rivalRating = (float) $track['rivalRating'] - 8.0 + ($idx * 2.1);
            $entrants[] = [
                'driverId' => 'rival-' . $idx,
                'driverName' => $rivalName,
                'carName' => 'Syndicate Spec #' . ($idx + 2),
                'class' => $track['recommendedClass'],
                'isPlayer' => false,
                'rating' => $rivalRating,
                'totalTimeMs' => 0,
                'lapTimesMs' => [],
            ];
        }

        $lapTelemetry = [];
        for ($lap = 1; $lap <= $lapsCount; $lap++) {
            foreach ($entrants as &$entrant) {
                $jitter = $this->roll(-900, 900);
                $speedReduction = (int) round($entrant['rating'] * 195);
                $lapMs = max(36000, $baseLapMs - $speedReduction + $jitter);
                $entrant['lapTimesMs'][] = $lapMs;
                $entrant['totalTimeMs'] += $lapMs;
            }
            unset($entrant);

            $sortedLap = $entrants;
            usort($sortedLap, static fn (array $a, array $b): int => $a['totalTimeMs'] <=> $b['totalTimeMs']);
            $leaderMs = $sortedLap[0]['totalTimeMs'];
            $lapTelemetry[] = [
                'lap' => $lap,
                'leader' => $sortedLap[0]['driverName'],
                'standings' => array_map(static fn (array $e, int $pos): array => [
                    'position' => $pos + 1,
                    'driver' => $e['driverName'],
                    'isPlayer' => $e['isPlayer'],
                    'lapTimeMs' => $e['lapTimesMs'][$lap - 1],
                    'gapMs' => $e['totalTimeMs'] - $leaderMs,
                ], $sortedLap, array_keys($sortedLap)),
            ];
        }

        usort($entrants, static fn (array $a, array $b): int => $a['totalTimeMs'] <=> $b['totalTimeMs']);
        $position = 8;
        $leaderFinishMs = $entrants[0]['totalTimeMs'];
        $finalStandings = [];
        foreach ($entrants as $idx => $e) {
            $pos = $idx + 1;
            if ($e['isPlayer']) {
                $position = $pos;
            }
            $finalStandings[] = [
                'position' => $pos,
                'driver' => $e['driverName'],
                'carName' => $e['carName'],
                'isPlayer' => $e['isPlayer'],
                'totalTimeMs' => $e['totalTimeMs'],
                'gapMs' => $e['totalTimeMs'] - $leaderFinishMs,
            ];
        }

        $pointsAwarded = match ($position) {
            1 => 12,
            2 => 9,
            3 => 7,
            4 => 5,
            5 => 4,
            default => 3,
        };
        $purseShare = match ($position) {
            1 => 1.00,
            2 => 0.60,
            3 => 0.35,
            default => 0.0,
        };
        $podiumCash = (int) round((int) $track['basePurse'] * $purseShare);
        $xpGain = $position <= 3 ? (int) $track['xp'] : (int) ceil((int) $track['xp'] * 0.5);
        $skillGain = $position === 1 ? 4 : ($position <= 3 ? 3 : 2);
        $newRacingSkill = min(100, $racingSkill + $skillGain);

        $newCash = (int) $player['cash'] + $podiumCash;
        $newXp = (int) $player['xp'] + $xpGain;
        $this->database->execute(
            'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
            ['cash' => $newCash, 'xp' => $newXp, 'id' => $playerId],
        );
        if ($podiumCash > 0) {
            $this->ledger->record($playerId, 'cash', $podiumCash, $newCash, 'race.podium.' . $trackId, $correlationId);
        }

        $state['racingPoints'] = max(0, (int) ($state['racingPoints'] ?? 0)) + $pointsAwarded;
        $this->ledger->record($playerId, 'racing_points', $pointsAwarded, (int) $state['racingPoints'], 'race.points.' . $trackId, $correlationId);
        $state['skill']['racing'] = $newRacingSkill;

        $garage['cars'][$carId]['races'] = (int) ($garage['cars'][$carId]['races'] ?? 0) + 1;
        if ($position === 1) {
            $garage['cars'][$carId]['wins'] = (int) ($garage['cars'][$carId]['wins'] ?? 0) + 1;
            $garage['totalWins'] = (int) ($garage['totalWins'] ?? 0) + 1;
        }
        if ($position <= 3) {
            $garage['cars'][$carId]['podiums'] = (int) ($garage['cars'][$carId]['podiums'] ?? 0) + 1;
            $garage['totalPodiums'] = (int) ($garage['totalPodiums'] ?? 0) + 1;
        }
        $garage['totalRaces'] = (int) ($garage['totalRaces'] ?? 0) + 1;
        $garage['lastRace'] = [
            'trackId' => $trackId,
            'trackName' => $track['nameEn'],
            'carId' => $carId,
            'position' => $position,
            'podiumCash' => $podiumCash,
            'pointsAwarded' => $pointsAwarded,
            'at' => gmdate('c', $this->now()),
        ];

        $levelUp = $this->leveling->sync($playerId, $correlationId);
        $this->daily->recordProgress($playerId, 'races', 1);

        $this->events->publish(new DomainEvent('StreetRaceCompleted', [
            'playerId' => $playerId,
            'trackId' => $trackId,
            'carId' => $carId,
            'position' => $position,
            'podiumCash' => $podiumCash,
            'racingPointsAwarded' => $pointsAwarded,
            'racingSkill' => $newRacingSkill,
            'correlationId' => $correlationId,
        ]));

        return [
            'trackId' => $trackId,
            'trackNameEn' => $track['nameEn'],
            'trackNameAr' => $track['nameAr'],
            'carId' => $carId,
            'laps' => $lapsCount,
            'energySpent' => 10,
            'position' => $position,
            'podium' => $position <= 3,
            'podiumCash' => $podiumCash,
            'racingPointsAwarded' => $pointsAwarded,
            'racingPointsBalance' => (int) $state['racingPoints'],
            'skillGain' => $newRacingSkill - $racingSkill,
            'racingSkill' => $newRacingSkill,
            'xpAwarded' => $xpGain,
            'levelUp' => $levelUp,
            'standings' => $finalStandings,
            'telemetry' => $lapTelemetry,
        ];
    }

    // ------------------------------------------------------------------
    // Snapshot & Internal Helpers
    // ------------------------------------------------------------------

    private function ensureActivityState(string $playerId, array $player, array &$state): bool
    {
        $changed = false;
        if (!isset($state['missionCredits'])) {
            $state['missionCredits'] = 0;
            $changed = true;
        }
        if (!isset($state['racingPoints'])) {
            $state['racingPoints'] = 0;
            $changed = true;
        }
        $state['skill'] = is_array($state['skill'] ?? null) ? $state['skill'] : [];
        if (!isset($state['skill']['hunting'])) {
            $state['skill']['hunting'] = 0;
            $changed = true;
        }
        if (!isset($state['skill']['racing'])) {
            $state['skill']['racing'] = 0;
            $changed = true;
        }

        if (!isset($state['cityActivities']) || !is_array($state['cityActivities'])) {
            $state['cityActivities'] = [];
            $changed = true;
        }

        if (empty($state['cityActivities']['missionAgents']['contracts']) || !is_array($state['cityActivities']['missionAgents']['contracts'])) {
            $metrics = $this->livePlayerMetrics($playerId, $state);
            $state['cityActivities']['missionAgents'] = [
                'contracts' => $this->generateThreeContracts((int) $player['level'], $metrics),
                'completedCount' => 0,
                'refreshes' => 0,
            ];
            $changed = true;
        }

        if (!isset($state['cityActivities']['dump']) || !is_array($state['cityActivities']['dump'])) {
            $state['cityActivities']['dump'] = [
                'tossedCount' => 0,
                'searchCount' => 0,
                'firstTossHonor' => !empty($state['claimedHonors']['dump_tosser']),
                'lastFound' => null,
            ];
            $changed = true;
        }

        if (!isset($state['cityActivities']['loan']) || !is_array($state['cityActivities']['loan'])) {
            $state['cityActivities']['loan'] = [
                'principal' => 0,
                'vigorishOwed' => 0,
                'borrowedAt' => null,
                'dueAt' => null,
                'lastAccruedAt' => null,
                'dukeEnforcerHeat' => false,
            ];
            $changed = true;
        }
        if ($this->accrueLoanState($state['cityActivities']['loan'])) {
            $changed = true;
        }

        if (!isset($state['cityActivities']['wheels']) || !is_array($state['cityActivities']['wheels'])) {
            $state['cityActivities']['wheels'] = [];
            $changed = true;
        }

        if (!isset($state['cityActivities']['hunting']) || !is_array($state['cityActivities']['hunting'])) {
            $state['cityActivities']['hunting'] = [
                'expeditions' => 0,
                'totalEarned' => 0,
                'trophiesFound' => 0,
            ];
            $changed = true;
        }

        if (!isset($state['cityActivities']['racing']) || !is_array($state['cityActivities']['racing'])) {
            $state['cityActivities']['racing'] = [
                'cars' => [],
                'activeCarId' => null,
                'totalRaces' => 0,
                'totalWins' => 0,
                'totalPodiums' => 0,
                'lastRace' => null,
            ];
            $changed = true;
        }

        return $changed;
    }

    private function buildSnapshotPayload(string $playerId, array $player, array $state): array
    {
        $now = $this->now();
        $today = gmdate('Y-m-d', $now);
        $metrics = $this->livePlayerMetrics($playerId, $state);

        // Format 3 Mission Agent contracts with live progress
        $contractsOut = [];
        foreach ($state['cityActivities']['missionAgents']['contracts'] ?? [] as $idx => $c) {
            $status = (string) ($c['status'] ?? 'available');
            $target = max(1, (int) ($c['target'] ?? 1));
            $currentMetric = (int) ($metrics[$c['metric']] ?? 0);
            $progress = $status === 'completed'
                ? $target
                : ($status === 'accepted' ? min($target, max(0, $currentMetric - (int) ($c['baseline'] ?? 0))) : 0);
            $agent = self::AGENTS[$c['agentId']] ?? self::AGENTS['duke'];
            $contractsOut[] = [
                ...$c,
                'slot' => $idx,
                'agent' => $agent['nameEn'],
                'agentNameEn' => $agent['nameEn'],
                'agentNameAr' => $agent['nameAr'],
                'agentRoleEn' => $agent['roleEn'],
                'agentRoleAr' => $agent['roleAr'],
                'cash' => (int) $c['rewardCash'],
                'credits' => (int) $c['missionCredits'],
                'progress' => $progress,
                'remaining' => max(0, $target - $progress),
                'progressPct' => (int) min(100, round($progress / $target * 100)),
                'canAccept' => $status === 'available',
                'canComplete' => $status === 'accepted' && $progress >= $target,
            ];
        }

        // Dump snapshot
        $dumpPool = $this->loadDumpPool();
        $dumpUnits = $this->countDumpUnits($dumpPool);

        // Loan Shark snapshot
        $loan = $state['cityActivities']['loan'] ?? [];
        $principal = max(0, (int) ($loan['principal'] ?? 0));
        $vigorish = max(0, (int) ($loan['vigorishOwed'] ?? 0));
        $maxLoan = self::maxLoanForLevel((int) $player['level']);
        $borrowedAt = $loan['borrowedAt'] ?? null;
        $dueAt = $loan['dueAt'] ?? null;
        $heat = (bool) ($loan['dukeEnforcerHeat'] ?? false);

        // Wheels snapshot
        $wheelsOut = [];
        foreach (self::SPIN_WHEELS as $wId => $wDef) {
            $ws = $state['cityActivities']['wheels'][$wId] ?? [];
            $remCd = max(0, (int) ($ws['cooldownUntil'] ?? 0) - $now);
            $wheelsOut[] = [
                'id' => $wId,
                'nameEn' => $wDef['nameEn'],
                'nameAr' => $wDef['nameAr'],
                'costCash' => (int) $wDef['costCash'],
                'cooldownRemainingSeconds' => $remCd,
                'canSpin' => $remCd === 0 && (int) $player['cash'] >= (int) $wDef['costCash'],
                'spinsToday' => ($ws['lastDay'] ?? '') === $today ? (int) ($ws['spinsToday'] ?? 0) : 0,
                'totalSpins' => (int) ($ws['totalSpins'] ?? 0),
                'lastPrize' => $ws['lastPrize'] ?? null,
                'prizes' => array_map(static fn (array $p): array => [
                    'id' => $p['id'],
                    'type' => $p['type'],
                    'labelEn' => $p['labelEn'],
                    'labelAr' => $p['labelAr'],
                    'chancePct' => round(((int) $p['weight']) / 100, 1),
                ], $wDef['prizes']),
            ];
        }

        // Hunting snapshot
        $huntingSkill = max(0, min(100, (int) ($state['skill']['hunting'] ?? 0)));
        $huntModesOut = [];
        foreach (self::HUNT_MODES as $mId => $mDef) {
            $unlocked = $huntingSkill >= (int) $mDef['minSkill'];
            $huntModesOut[] = [
                'id' => $mId,
                'nameEn' => $mDef['nameEn'],
                'nameAr' => $mDef['nameAr'],
                'energyCost' => (int) $mDef['energy'],
                'feeCash' => (int) $mDef['fee'],
                'minSkill' => (int) $mDef['minSkill'],
                'unlocked' => $unlocked,
                'expectedPayoutMin' => (int) round((int) $mDef['cashMin'] * (1.0 + $huntingSkill * 0.018)),
                'expectedPayoutMax' => (int) round((int) $mDef['cashMax'] * (1.0 + $huntingSkill * 0.018)),
            ];
        }

        // Racing & Garage snapshot
        $racingSkill = max(0, min(100, (int) ($state['skill']['racing'] ?? 0)));
        $garage = $state['cityActivities']['racing'] ?? ['cars' => [], 'activeCarId' => null];
        $ownedCars = is_array($garage['cars'] ?? null) ? $garage['cars'] : [];
        $dealership = [];
        foreach (self::CARS as $cId => $cDef) {
            $ownedEntry = $ownedCars[$cId] ?? null;
            $dealership[] = [
                ...$cDef,
                'owned' => $ownedEntry !== null,
                'active' => ($garage['activeCarId'] ?? null) === $cId,
                'upgrades' => $ownedEntry['upgrades'] ?? [],
                'races' => (int) ($ownedEntry['races'] ?? 0),
                'wins' => (int) ($ownedEntry['wins'] ?? 0),
                'effectiveStats' => $this->computeCarStats($cId, $ownedEntry['upgrades'] ?? []),
            ];
        }

        $inventoryList = [];
        foreach (($state['inv'] ?? []) as $itemId => $qty) {
            if ((int) $qty > 0) {
                $inventoryList[] = ['itemId' => (string) $itemId, 'quantity' => (int) $qty];
            }
        }

        $armoryOut = array_values(array_map(static fn (array $o): array => [
            ...$o,
            'cost' => (int) $o['costCredits'],
            'credits' => (int) $o['costCredits'],
        ], self::MISSION_ARMORY));

        return [
            'levelGates' => TornSystemsService::buildLevelGates((int) $player['level']),
            'player' => [
                'id' => (string) $player['id'],
                'username' => (string) $player['username'],
                'level' => (int) $player['level'],
                'cash' => (int) $player['cash'],
                'energy' => (int) $player['energy'],
                'maxEnergy' => (int) $player['max_energy'],
                'nerve' => (int) $player['nerve'],
                'happy' => (int) $player['happy'],
                'points' => (int) ($state['points'] ?? 0),
                'merits' => (int) ($state['merits'] ?? 0),
                'missionCredits' => (int) ($state['missionCredits'] ?? 0),
                'racingPoints' => (int) ($state['racingPoints'] ?? 0),
            ],
            'missionCredits' => (int) ($state['missionCredits'] ?? 0),
            'racingPoints' => (int) ($state['racingPoints'] ?? 0),
            'dumpCount' => $dumpUnits,
            'inventory' => $inventoryList,
            'missionAgents' => [
                'missionCredits' => (int) ($state['missionCredits'] ?? 0),
                'refreshEnergyCost' => 10,
                'completedCount' => (int) ($state['cityActivities']['missionAgents']['completedCount'] ?? 0),
                'agents' => array_values(self::AGENTS),
                'contracts' => $contractsOut,
                'armoryShop' => $armoryOut,
            ],
            'dump' => [
                'searchEnergyCost' => 5,
                'poolSize' => $dumpUnits,
                'poolTotalUnits' => $dumpUnits,
                'recentItems' => array_slice(array_reverse($dumpPool['items']), 0, 8),
                'tossedCount' => (int) ($state['cityActivities']['dump']['tossedCount'] ?? 0),
                'searchCount' => (int) ($state['cityActivities']['dump']['searchCount'] ?? 0),
                'firstTossHonor' => !empty($state['claimedHonors']['dump_tosser']),
                'lastFound' => $state['cityActivities']['dump']['lastFound'] ?? null,
            ],
            'loanShark' => [
                'npc' => 'Duke',
                'maxLoan' => $maxLoan,
                'availableCredit' => max(0, $maxLoan - $principal),
                'vigorishRatePct' => 5.0,
                'overdueHoursLimit' => 72,
                'active' => ($principal + $vigorish) > 0,
                'principal' => $principal,
                'owed' => $principal + $vigorish,
                'vigorishOwed' => $vigorish,
                'totalOwed' => $principal + $vigorish,
                'borrowedAt' => $borrowedAt !== null ? gmdate('c', (int) $borrowedAt) : null,
                'dueAt' => $dueAt !== null ? gmdate('c', (int) $dueAt) : null,
                'dukeEnforcerHeat' => $heat,
                'overdue' => $heat,
            ],
            'dukeEnforcerHeat' => $heat,
            'spinWheels' => $wheelsOut,
            'hunting' => [
                'skill' => $huntingSkill,
                'maxSkill' => 100,
                'masterUnlocked' => $huntingSkill >= 50,
                'expeditions' => (int) ($state['cityActivities']['hunting']['expeditions'] ?? 0),
                'totalEarned' => (int) ($state['cityActivities']['hunting']['totalEarned'] ?? 0),
                'trophiesFound' => (int) ($state['cityActivities']['hunting']['trophiesFound'] ?? 0),
                'modes' => $huntModesOut,
            ],
            'racing' => [
                'skill' => $racingSkill,
                'maxSkill' => 100,
                'racingPoints' => (int) ($state['racingPoints'] ?? 0),
                'trackEnergyCost' => 10,
                'activeCarId' => $garage['activeCarId'] ?? null,
                'ownedCars' => (object) $ownedCars,
                'totalRaces' => (int) ($garage['totalRaces'] ?? 0),
                'totalWins' => (int) ($garage['totalWins'] ?? 0),
                'totalPodiums' => (int) ($garage['totalPodiums'] ?? 0),
                'lastRace' => $garage['lastRace'] ?? null,
                'cars' => $dealership,
                'upgradesCatalog' => array_values(self::CAR_UPGRADES),
                'tracks' => array_values(self::TRACKS),
            ],
            'dailyContracts' => $this->daily->contractState($playerId),
            'serverTime' => gmdate('c', $now),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function generateThreeContracts(int $playerLevel, array $metrics): array
    {
        $isElite = $playerLevel >= 10;
        $templates = [
            'easy' => [
                ['agentId' => 'layla', 'metric' => 'crimes', 'target' => 3, 'cash' => 10000, 'xp' => 150, 'credits' => 18, 'titleEn' => 'Dockside Misdirection: Commit 3 crimes', 'titleAr' => 'تمويه الأرصفة: نفّذ 3 جرائم'],
                ['agentId' => 'duke', 'metric' => 'trains', 'target' => 2, 'cash' => 9500, 'xp' => 140, 'credits' => 15, 'titleEn' => 'Muscle Conditioning: Train 2 sessions in the Gym', 'titleAr' => 'تجهيز العضلات: تدرّب جلستين في النادي'],
                ['agentId' => 'mayor_tariq', 'metric' => 'buys', 'target' => 2, 'cash' => 12000, 'xp' => 160, 'credits' => 20, 'titleEn' => 'Municipal Kickback: Buy 2 items from the market', 'titleAr' => 'عمولة البلدية: اشترِ عنصرين من السوق'],
            ],
            'medium' => [
                ['agentId' => 'duke', 'metric' => 'wins', 'target' => 2, 'cash' => 28000, 'xp' => 300, 'credits' => 35, 'titleEn' => 'Debt Collection: Win 2 combat encounters', 'titleAr' => 'تحصيل الديون: افُز بمواجهتَين قتاليتَين'],
                ['agentId' => 'madame_vega', 'metric' => 'crimes', 'target' => 8, 'cash' => 32000, 'xp' => 320, 'credits' => 40, 'titleEn' => ' Runway Smokescreen: Commit 8 street crimes', 'titleAr' => 'ستار المدرج: نفّذ 8 جرائم شوارع'],
                ['agentId' => 'layla', 'metric' => 'trains', 'target' => 5, 'cash' => 26000, 'xp' => 280, 'credits' => 32, 'titleEn' => 'Enforcer Drill: Complete 5 Gym training sessions', 'titleAr' => 'تدريب المنفّذين: أكمل 5 جلسات نادي'],
            ],
            'hard' => [
                ['agentId' => 'duke', 'metric' => 'muggedCash', 'target' => 5000, 'cash' => 68000, 'xp' => 560, 'credits' => 60, 'titleEn' => 'Shakedown Quota: Mug $5,000 cash in combat', 'titleAr' => 'حصة الابتزاز: اسلب 5,000$ بالنهب القتالي'],
                ['agentId' => 'mayor_tariq', 'metric' => 'wins', 'target' => 4, 'cash' => 75000, 'xp' => 620, 'credits' => 65, 'titleEn' => 'Silence the Opposition: Win 4 combat fights', 'titleAr' => 'إسكات الخصوم: افُز بـ4 معارك قتالية'],
                ['agentId' => 'madame_vega', 'metric' => 'crimes', 'target' => 15, 'cash' => 85000, 'xp' => 700, 'credits' => 75, 'titleEn' => 'Cartel Sweep: Execute 15 successful crimes', 'titleAr' => 'حملة الكارتل: نفّذ 15 جريمة ناجحة'],
            ],
        ];

        $slots = [
            ['pool' => 'easy', 'label' => 'Easy'],
            ['pool' => 'medium', 'label' => 'Medium'],
            ['pool' => 'hard', 'label' => $isElite ? 'Elite' : 'Hard'],
        ];

        $out = [];
        foreach ($slots as $slotDef) {
            $choices = $templates[$slotDef['pool']];
            $pick = $choices[$this->roll(0, count($choices) - 1)];
            $metric = (string) $pick['metric'];
            $out[] = [
                'id' => 'agt-' . bin2hex(random_bytes(6)),
                'agentId' => $pick['agentId'],
                'tier' => $slotDef['label'],
                'metric' => $metric,
                'target' => (int) $pick['target'],
                'baseline' => (int) ($metrics[$metric] ?? 0),
                'rewardCash' => (int) $pick['cash'],
                'rewardXp' => (int) $pick['xp'],
                'missionCredits' => (int) $pick['credits'],
                'titleEn' => trim((string) $pick['titleEn']),
                'titleAr' => trim((string) $pick['titleAr']),
                'status' => 'available',
                'accepted' => false,
                'completed' => false,
            ];
        }
        return $out;
    }

    /** @return array<string, int> */
    private function livePlayerMetrics(string $playerId, array $state): array
    {
        $mugRow = $this->database->fetchOne(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM economy_ledger WHERE player_id = :id AND asset = 'cash' AND amount > 0 AND reason IN ('combat.mug', 'player-combat.mug.credit')",
            ['id' => $playerId],
        );
        return [
            'crimes' => max(0, (int) ($state['ctr']['crimes'] ?? 0)),
            'wins' => max(0, (int) ($state['ctr']['wins'] ?? 0)),
            'trains' => max(0, (int) ($state['ctr']['trains'] ?? 0)),
            'buys' => max(0, (int) ($state['ctr']['buys'] ?? 0)),
            'muggedCash' => max(0, (int) ($mugRow['total'] ?? 0)),
        ];
    }

    /** @param list<array<string, mixed>> $contracts */
    private function findContractIndex(array $contracts, array $payload): int
    {
        $id = trim((string) ($payload['contractId'] ?? $payload['id'] ?? ''));
        if ($id !== '') {
            foreach ($contracts as $idx => $c) {
                if (($c['id'] ?? '') === $id) {
                    return $idx;
                }
            }
        }
        if (isset($payload['slot']) && is_numeric($payload['slot'])) {
            $slot = (int) $payload['slot'];
            if (isset($contracts[$slot])) {
                return $slot;
            }
        }
        throw new InvalidArgumentException('Unknown NPC mission contract identifier.');
    }

    private function computeCarStats(string $carId, array $upgrades): array
    {
        $base = self::CARS[$carId] ?? self::CARS['civic_e'];
        $topSpeed = (int) $base['topSpeed'];
        $accel = (int) $base['accel'];
        $handling = (int) $base['handling'];
        foreach ($upgrades as $partId => $stage) {
            $part = self::CAR_UPGRADES[$partId] ?? null;
            if ($part === null) {
                continue;
            }
            $s = max(0, min((int) $part['maxStage'], (int) $stage));
            $topSpeed += (int) $part['topSpeed'] * $s;
            $accel += (int) $part['accel'] * $s;
            $handling += (int) $part['handling'] * $s;
        }
        $rating = round(($topSpeed * 0.36) + ($accel * 0.32) + ($handling * 0.32), 1);
        return [
            'topSpeed' => $topSpeed,
            'accel' => $accel,
            'handling' => $handling,
            'rating' => $rating,
        ];
    }

    private function resolveTrackId(string $raw): string
    {
        $clean = strtolower(trim($raw));
        if (isset(self::TRACKS[$clean])) {
            return $clean;
        }
        $snake = preg_replace('/[^a-z0-9]+/', '_', $clean) ?? '';
        $snake = trim($snake, '_');
        if (isset(self::TRACKS[$snake])) {
            return $snake;
        }
        foreach (self::TRACKS as $id => $def) {
            if (strtolower((string) $def['nameEn']) === $clean) {
                return $id;
            }
        }
        throw new InvalidArgumentException("Unknown race track: {$raw}");
    }

    private function loadDumpPool(): array
    {
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => self::DUMP_META_KEY]);
        if ($row === null || !isset($row['value'])) {
            return $this->defaultDumpPool();
        }
        $decoded = json_decode((string) $row['value'], true);
        if (!is_array($decoded) || !isset($decoded['items']) || !is_array($decoded['items']) || $decoded['items'] === []) {
            return $this->defaultDumpPool();
        }
        return $decoded;
    }

    private function saveDumpPool(array $pool): void
    {
        $encoded = json_encode($pool, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :value) ON CONFLICT (name) DO UPDATE SET value = :updated',
            ['name' => self::DUMP_META_KEY, 'value' => $encoded, 'updated' => $encoded],
        );
    }

    private function defaultDumpPool(): array
    {
        $nowIso = gmdate('c', $this->now());
        return [
            'totalTossed' => 32,
            'totalSearched' => 0,
            'items' => [
                ['itemId' => 'smallkit', 'qty' => 6, 'tossedBy' => 'Harbor Clinic', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'drink', 'qty' => 6, 'tossedBy' => 'Dockworker', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'bat', 'qty' => 4, 'tossedBy' => 'Street Punk', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'knife', 'qty' => 3, 'tossedBy' => 'Night Alley', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'glasses', 'qty' => 3, 'tossedBy' => 'Pawn Broker', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'duct_tape', 'qty' => 3, 'tossedBy' => 'Warehouse Crew', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'medkit', 'qty' => 2, 'tossedBy' => 'Paramedic Unit', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'plush_camel', 'qty' => 2, 'tossedBy' => 'Tourist', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'flower_cherry', 'qty' => 2, 'tossedBy' => 'Airport Customs', 'playerTossed' => false, 'at' => $nowIso],
                ['itemId' => 'pistol', 'qty' => 1, 'tossedBy' => 'Anonymous Suspect', 'playerTossed' => false, 'at' => $nowIso],
            ],
        ];
    }

    private function countDumpUnits(array $pool): int
    {
        $sum = 0;
        foreach ($pool['items'] ?? [] as $e) {
            $sum += max(0, (int) ($e['qty'] ?? 0));
        }
        return $sum;
    }

    private function assertCatalogItem(string $itemId): array
    {
        $catalog = (new GameplayCatalog($this->database, $this->events))->active();
        if (!isset($catalog['items'][$itemId])) {
            throw new InvalidArgumentException("Unknown catalog item: {$itemId}");
        }
        return $catalog['items'][$itemId];
    }

    private function requirePlayer(string $playerId): array
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
            (new ProgressionService($this->database, $this->events))->snapshot($playerId);
            $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
            if ($row === null) {
                throw new RuntimeException("Progression state missing for player: {$playerId}");
            }
        }
        return [
            json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR),
            (int) $row['version'],
        ];
    }

    private function saveProgression(string $playerId, array $state, int $version): void
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
        if (getenv('ZONE_EPHEMERAL_VERCEL_SQLITE') === '1') {
            SyndicateSocialService::refreshEphemeralLedgerCookie($this->database, $this->events, $playerId);
        }
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

    private function parseBoundedInt(mixed $raw, int $min, int $max, string $label): int
    {
        if (is_int($raw)) {
            $val = $raw;
        } elseif (is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1) {
            $val = (int) trim($raw);
        } elseif (is_float($raw) && floor($raw) === $raw) {
            $val = (int) $raw;
        } else {
            throw new InvalidArgumentException("Invalid {$label}: whole integer required.");
        }
        if ($val < $min || $val > $max) {
            throw new InvalidArgumentException("{$label} must be between " . number_format($min) . ' and ' . number_format($max) . '.');
        }
        return $val;
    }

    private function now(): int
    {
        return $this->clock === null ? time() : (int) ($this->clock)();
    }

    private function roll(int $min, int $max): int
    {
        if ($this->random !== null) {
            $val = (int) ($this->random)($min, $max);
            return max($min, min($max, $val));
        }
        return random_int($min, $max);
    }
}

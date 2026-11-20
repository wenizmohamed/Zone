<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class ForeignMarketService
{
    public const STOCK_META_KEY = 'foreign-market-stock-v1';
    private const TRIP_META_PREFIX = 'foreign-trip-v1:';
    public const RESTOCK_WINDOW_SECONDS = 900;

    /** @var array<string, array<string, mixed>> */
    public const HUBS = [
        'mexico' => [
            'id' => 'mexico',
            'code' => 'MEX',
            'nameEn' => 'Mexico (Juarez)',
            'nameAr' => 'المكسيك (خواريز)',
            'flightMinutes' => 3,
            'flightSeconds' => 180,
            'fare' => 6500,
            'specialEn' => 'Border Smuggling & Plushies',
            'specialAr' => 'تهريب الحدود والدمى النادرة',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'plush_camel' => ['nameEn' => 'Desert Camel Plushie', 'nameAr' => 'دمية الجمل النادرة', 'type' => 'plushie', 'price' => 1000, 'baseStock' => 28, 'homeValue' => 14000],
                'plush_jaguar' => ['nameEn' => 'Jaguar Plushie', 'nameAr' => 'دمية الجاغوار', 'type' => 'plushie', 'price' => 1100, 'baseStock' => 24, 'homeValue' => 15000],
                'flower_cherry' => ['nameEn' => 'Cherry Blossom', 'nameAr' => 'زهرة الكرز', 'type' => 'flower', 'price' => 900, 'baseStock' => 24, 'homeValue' => 12500],
                'pistol' => ['nameEn' => '9mm Service Pistol', 'nameAr' => 'مسدس 9 ملم', 'type' => 'weapon', 'price' => 15500, 'baseStock' => 14, 'homeValue' => 19000],
                'bolt_cutters' => ['nameEn' => 'Heavy Bolt Cutters', 'nameAr' => 'قاطع أقفال ثقيل', 'type' => 'material', 'price' => 4200, 'baseStock' => 16, 'homeValue' => 9500],
            ],
        ],
        'cayman' => [
            'id' => 'cayman',
            'code' => 'GCM',
            'nameEn' => 'Cayman Islands',
            'nameAr' => 'جزر كايمان',
            'flightMinutes' => 4,
            'flightSeconds' => 240,
            'fare' => 10000,
            'specialEn' => 'Offshore Banking & Exotic Flora',
            'specialAr' => 'المصارف الخارجية والزهور الاستوائية',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => true,
            'items' => [
                'plush_bear' => ['nameEn' => 'Stingray Bear Plushie', 'nameAr' => 'دمية الدب الكاريبي', 'type' => 'plushie', 'price' => 1200, 'baseStock' => 25, 'homeValue' => 16500],
                'flower_peony' => ['nameEn' => 'Caribbean Peony', 'nameAr' => 'زهرة الفاوانيا', 'type' => 'flower', 'price' => 1400, 'baseStock' => 20, 'homeValue' => 18000],
            ],
        ],
        'toronto' => [
            'id' => 'toronto',
            'code' => 'YYZ',
            'nameEn' => 'Toronto, Canada',
            'nameAr' => 'تورونتو (كندا)',
            'flightMinutes' => 4,
            'flightSeconds' => 240,
            'fare' => 9500,
            'specialEn' => 'Pharmaceutical Surplus & Orchids',
            'specialAr' => 'فائض الإمدادات الطبية والأوركيد',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'plush_moose' => ['nameEn' => 'Canadian Moose Plushie', 'nameAr' => 'دمية الموظ الكندي', 'type' => 'plushie', 'price' => 1150, 'baseStock' => 24, 'homeValue' => 17000],
                'flower_orchid' => ['nameEn' => 'White Frost Orchid', 'nameAr' => 'زهرة الأوركيد البيضاء', 'type' => 'flower', 'price' => 1250, 'baseStock' => 22, 'homeValue' => 17500],
                'morphine' => ['nameEn' => 'Hospital Morphine Ampoule', 'nameAr' => 'أمبولة مورفين طبي', 'type' => 'medical', 'price' => 34000, 'baseStock' => 14, 'homeValue' => 42000],
            ],
        ],
        'hawaii' => [
            'id' => 'hawaii',
            'code' => 'HNL',
            'nameEn' => 'Hawaii (Honolulu)',
            'nameAr' => 'هاواي (هونولولو)',
            'flightMinutes' => 6,
            'flightSeconds' => 360,
            'fare' => 18000,
            'specialEn' => 'Pacific Boosters & Sacred Lotus',
            'specialAr' => 'منشطات المحيط الهادئ وزهرة اللوتس',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'flower_lotus' => ['nameEn' => 'Pacific Sacred Lotus', 'nameAr' => 'زهرة اللوتس المقدسة', 'type' => 'flower', 'price' => 1500, 'baseStock' => 20, 'homeValue' => 22000],
                'energydrink' => ['nameEn' => 'Syndicate Energy Can (+25E)', 'nameAr' => 'مشروب طاقة مركز (+25)', 'type' => 'booster', 'price' => 145000, 'baseStock' => 12, 'homeValue' => 180000],
            ],
        ],
        'london' => [
            'id' => 'london',
            'code' => 'LCY',
            'nameEn' => 'London, UK',
            'nameAr' => 'لندن (بريطانيا)',
            'flightMinutes' => 7,
            'flightSeconds' => 420,
            'fare' => 18000,
            'specialEn' => 'Royal Plushies & Trauma Blood Supply',
            'specialAr' => 'دمى الأسد الملكي وأكياس الدم',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'plush_lion' => ['nameEn' => 'British Lion Plushie', 'nameAr' => 'دمية الأسد البريطاني', 'type' => 'plushie', 'price' => 1350, 'baseStock' => 22, 'homeValue' => 24000],
                'flower_violet' => ['nameEn' => 'Thames Heather Violet', 'nameAr' => 'زهرة البنفسج اللندنية', 'type' => 'flower', 'price' => 1300, 'baseStock' => 22, 'homeValue' => 21000],
                'bloodbag' => ['nameEn' => 'Sterile Blood Bag', 'nameAr' => 'كيس دم معقم', 'type' => 'medical', 'price' => 18000, 'baseStock' => 16, 'homeValue' => 22000],
            ],
        ],
        'zurich' => [
            'id' => 'zurich',
            'code' => 'ZRH',
            'nameEn' => 'Zurich, Switzerland',
            'nameAr' => 'زيورخ (سويسرا - مصحة العلاج)',
            'flightMinutes' => 8,
            'flightSeconds' => 480,
            'fare' => 22000,
            'specialEn' => 'Switzerland Addiction Rehab Clinic',
            'specialAr' => 'المصحة السويسرية لعلاج الإدمان',
            'hasRehabClinic' => true,
            'hasOffshoreBank' => false,
            'items' => [
                'snow_globe' => ['nameEn' => 'Alpine Snow Globe', 'nameAr' => 'كرة الثلج السويسرية', 'type' => 'material', 'price' => 4500, 'baseStock' => 18, 'homeValue' => 26000],
                'medkit' => ['nameEn' => 'Swiss Trauma Medkit', 'nameAr' => 'حقيبة إسعاف سويسرية', 'type' => 'medical', 'price' => 9500, 'baseStock' => 20, 'homeValue' => 12000],
            ],
        ],
        'dubai' => [
            'id' => 'dubai',
            'code' => 'DXB',
            'nameEn' => 'Dubai, UAE',
            'nameAr' => 'دبي (الإمارات)',
            'flightMinutes' => 9,
            'flightSeconds' => 540,
            'fare' => 28000,
            'specialEn' => 'Gold Souk Falcons & Heavy Rifles',
            'specialAr' => 'صقور الخليج والبنادق الهجومية',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'plush_falcon' => ['nameEn' => 'Golden Falcon Plushie', 'nameAr' => 'دمية الصقر الذهبي', 'type' => 'plushie', 'price' => 1300, 'baseStock' => 20, 'homeValue' => 29000],
                'flower_tribulus' => ['nameEn' => 'Tribulus Omanense', 'nameAr' => 'زهرة التريبولوس الصحراوية', 'type' => 'flower', 'price' => 1800, 'baseStock' => 18, 'homeValue' => 31000],
                'ak' => ['nameEn' => 'AK-47 Assault Rifle', 'nameAr' => 'بندقية كلاشينكوف هجومية', 'type' => 'weapon', 'price' => 215000, 'baseStock' => 8, 'homeValue' => 260000],
            ],
        ],
        'cairo' => [
            'id' => 'cairo',
            'code' => 'CAI',
            'nameEn' => 'Cairo, Egypt',
            'nameAr' => 'القاهرة (مصر)',
            'flightMinutes' => 8,
            'flightSeconds' => 480,
            'fare' => 24000,
            'specialEn' => 'Antiquities Quarter & Sidearms',
            'specialAr' => 'خان التحف والدمى الفرعونية',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'plush_pharaoh' => ['nameEn' => 'Pharaoh Plushie', 'nameAr' => 'دمية الفرعون الذهبية', 'type' => 'plushie', 'price' => 1550, 'baseStock' => 20, 'homeValue' => 27500],
                'revolver' => ['nameEn' => '.38 Snub Revolver', 'nameAr' => 'مسدس ريفولفر .38', 'type' => 'weapon', 'price' => 19500, 'baseStock' => 14, 'homeValue' => 24000],
            ],
        ],
        'tokyo' => [
            'id' => 'tokyo',
            'code' => 'HND',
            'nameEn' => 'Tokyo, Japan',
            'nameAr' => 'طوكيو (اليابان)',
            'flightMinutes' => 10,
            'flightSeconds' => 600,
            'fare' => 32000,
            'specialEn' => 'Precision Optics, eDVDs & Flashbangs',
            'specialAr' => 'القناصات الدقيقة وأقراص السعادة',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'sniper' => ['nameEn' => 'Precision Sniper Rifle', 'nameAr' => 'بندقية قنص بعيدة المدى', 'type' => 'weapon', 'price' => 395000, 'baseStock' => 6, 'homeValue' => 480000],
                'edvd' => ['nameEn' => 'Erotic DVD (+2500 Happy)', 'nameAr' => 'قرص ترفيهي نادر (+2500 سعادة)', 'type' => 'booster', 'price' => 2650000, 'baseStock' => 8, 'homeValue' => 3200000],
                'flash_grenade' => ['nameEn' => 'Tactical Flash Grenade', 'nameAr' => 'قنبلة ضوئية تكتيكية', 'type' => 'weapon', 'price' => 12000, 'baseStock' => 16, 'homeValue' => 15000],
            ],
        ],
        'beijing' => [
            'id' => 'beijing',
            'code' => 'PEK',
            'nameEn' => 'Beijing, China',
            'nameAr' => 'بكين (الصين)',
            'flightMinutes' => 10,
            'flightSeconds' => 600,
            'fare' => 32000,
            'specialEn' => 'Imperial Peonies & Tactical Smoke',
            'specialAr' => 'زهور الفاوانيا الإمبراطورية وقنابل الدخان',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'flower_peony' => ['nameEn' => 'Imperial Red Peony', 'nameAr' => 'زهرة الفاوانيا الإمبراطورية', 'type' => 'flower', 'price' => 1350, 'baseStock' => 24, 'homeValue' => 28000],
                'smoke_grenade' => ['nameEn' => 'Dense Smoke Grenade', 'nameAr' => 'قنبلة دخان كثيف', 'type' => 'weapon', 'price' => 14500, 'baseStock' => 16, 'homeValue' => 18000],
            ],
        ],
        'johannesburg' => [
            'id' => 'johannesburg',
            'code' => 'JNB',
            'nameEn' => 'Johannesburg, South Africa',
            'nameAr' => 'جوهانسبرغ (جنوب أفريقيا - زاناكس)',
            'flightMinutes' => 12,
            'flightSeconds' => 720,
            'fare' => 35000,
            'specialEn' => 'Wholesale Xanax ($740k) & Combat Stims',
            'specialAr' => 'مركز الزاناكس بالجملة ($740k) والمحفزات',
            'hasRehabClinic' => false,
            'hasOffshoreBank' => false,
            'items' => [
                'xanax' => ['nameEn' => 'Xanax (+250 Energy)', 'nameAr' => 'زاناكس (+250 طاقة)', 'type' => 'booster', 'price' => 740000, 'baseStock' => 15, 'homeValue' => 840000],
                'plush_lion' => ['nameEn' => 'Savanna Lion Plushie', 'nameAr' => 'دمية أسد السافانا', 'type' => 'plushie', 'price' => 1250, 'baseStock' => 20, 'homeValue' => 26000],
                'epinephrine' => ['nameEn' => 'Combat Epinephrine Injector', 'nameAr' => 'حقنة إبينفرين قتالية', 'type' => 'booster', 'price' => 52000, 'baseStock' => 10, 'homeValue' => 65000],
            ],
        ],
    ];

    private const PLUSHIE_SET_KEYS = ['plush_camel', 'plush_bear', 'plush_moose', 'plush_pharaoh', 'plush_falcon', 'plush_lion'];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;
    private readonly TravelService $travel;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?\Closure $clock = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
        $this->travel = new TravelService($database, $events, $clock);
    }

    public static function isHomeCity(string $city): bool
    {
        $norm = strtolower(trim($city));
        return $norm === '' || $norm === 'zone city' || $norm === 'harbor';
    }

    public static function resolveHubId(string $cityOrHub): ?string
    {
        $norm = strtolower(trim($cityOrHub));
        if (isset(self::HUBS[$norm])) {
            return $norm;
        }
        $aliases = [
            'south africa' => 'johannesburg',
            'jnb' => 'johannesburg',
            'switzerland' => 'zurich',
            'zrh' => 'zurich',
            'uae' => 'dubai',
            'dxb' => 'dubai',
            'uk' => 'london',
            'lcy' => 'london',
            'canada' => 'toronto',
            'yyz' => 'toronto',
            'japan' => 'tokyo',
            'hnd' => 'tokyo',
            'china' => 'beijing',
            'pek' => 'beijing',
            'egypt' => 'cairo',
            'cai' => 'cairo',
            'cayman islands' => 'cayman',
            'gcm' => 'cayman',
            'mex' => 'mexico',
            'hnl' => 'hawaii',
        ];
        return $aliases[$norm] ?? null;
    }

    public function snapshot(string $playerId): array
    {
        $travelSnap = $this->travel->snapshot($playerId);
        $player = $this->requirePlayer($playerId);
        $progRow = $this->loadProgressionRow($playerId);
        $progState = $progRow['state'];
        $perks = $this->resolvePerks($playerId, $progState);
        $now = $this->now();
        $stocks = $this->loadOrRestockGlobal($now);
        $tripState = $this->loadTripState($playerId, (int) ($travelSnap['version'] ?? 0));

        $currentCity = (string) $player['city'];
        $isTraveling = ($travelSnap['status'] ?? null) === 'traveling';
        $activeHubId = !$isTraveling && !self::isHomeCity($currentCity)
            ? self::resolveHubId($currentCity)
            : null;

        $hubsList = [];
        foreach (self::HUBS as $hubId => $hub) {
            $flightSeconds = $perks['hasAirstrip']
                ? max(30, (int) round((int) $hub['flightSeconds'] * 0.70))
                : (int) $hub['flightSeconds'];
            $fare = $perks['hasAirstrip'] ? 0 : (int) $hub['fare'];
            $hubItems = [];
            foreach ($hub['items'] as $itemId => $itemSpec) {
                $hubItems[] = [
                    'id' => $itemId,
                    'nameEn' => $itemSpec['nameEn'],
                    'nameAr' => $itemSpec['nameAr'],
                    'type' => $itemSpec['type'],
                    'price' => (int) $itemSpec['price'],
                    'homeValue' => (int) $itemSpec['homeValue'],
                    'stock' => max(0, (int) ($stocks[$hubId][$itemId] ?? $itemSpec['baseStock'])),
                    'baseStock' => (int) $itemSpec['baseStock'],
                    'ownedQty' => max(0, (int) ($progState['inv'][$itemId] ?? 0)),
                ];
            }
            $hubsList[] = [
                'id' => $hubId,
                'code' => $hub['code'],
                'nameEn' => $hub['nameEn'],
                'nameAr' => $hub['nameAr'],
                'baseFlightSeconds' => (int) $hub['flightSeconds'],
                'flightSeconds' => $flightSeconds,
                'flightMinutesLabel' => round($flightSeconds / 60, 1),
                'baseFare' => (int) $hub['fare'],
                'fare' => $fare,
                'specialEn' => $hub['specialEn'],
                'specialAr' => $hub['specialAr'],
                'hasRehabClinic' => (bool) $hub['hasRehabClinic'],
                'hasOffshoreBank' => (bool) $hub['hasOffshoreBank'],
                'isCurrentCity' => $activeHubId === $hubId,
                'items' => $hubItems,
            ];
        }

        $currentShop = null;
        if ($activeHubId !== null) {
            foreach ($hubsList as $entry) {
                if ($entry['id'] === $activeHubId) {
                    $currentShop = $entry;
                    break;
                }
            }
        }

        $addiction = max((int) ($progState['addiction'] ?? 0), (int) ($progState['tornState']['addiction'] ?? 0));
        $overdoseCount = (int) ($progState['cooldowns']['overdoseCount'] ?? 0);
        $rehabCost = ($addiction > 0 || $overdoseCount > 0) ? max(10000, $addiction * 12000) : 0;

        $nextRestockEpoch = (intdiv($now, self::RESTOCK_WINDOW_SECONDS) + 1) * self::RESTOCK_WINDOW_SECONDS;

        return [
            'player' => $player,
            'currentCity' => $currentCity,
            'isHomeCity' => self::isHomeCity($currentCity) && !$isTraveling,
            'isAbroad' => !self::isHomeCity($currentCity) && !$isTraveling,
            'activeHubId' => $activeHubId,
            'travel' => $travelSnap ?? [
                'origin' => 'Zone City',
                'destination' => $currentCity,
                'status' => 'idle',
                'remainingSeconds' => 0,
                'totalSeconds' => 0,
                'progressPct' => 100,
                'version' => 0,
            ],
            'perks' => $perks,
            'luggage' => [
                'used' => $tripState['bought'],
                'capacity' => $perks['capacity'],
                'remaining' => max(0, $perks['capacity'] - $tripState['bought']),
                'base' => 5,
                'islandBonus' => $perks['islandBonus'],
                'suitcaseBonus' => $perks['suitcaseBonus'],
            ],
            'rehabClinic' => [
                'availableHere' => $activeHubId === 'zurich',
                'addiction' => $addiction,
                'overdoseCount' => $overdoseCount,
                'cost' => $rehabCost,
                'canRehab' => $activeHubId === 'zurich' && ($addiction > 0 || $overdoseCount > 0) && (int) $player['cash'] >= $rehabCost,
            ],
            'currentShop' => $currentShop,
            'hubs' => $hubsList,
            'restockWindow' => intdiv($now, self::RESTOCK_WINDOW_SECONDS),
            'restockInSeconds' => max(1, $nextRestockEpoch - $now),
            'serverTime' => gmdate('c', $now),
        ];
    }

    public function act(string $action, array $payload, string $playerId): array
    {
        $cleanAction = strtolower(trim($action));
        if (!in_array($cleanAction, ['depart', 'return', 'buy', 'rehab'], true)) {
            throw new InvalidArgumentException('Unsupported foreign market action: ' . $action);
        }

        return $this->database->playerTransaction($playerId, function () use ($cleanAction, $payload, $playerId): array {
            $this->resources->regenerate($playerId);
            $travelSnap = $this->travel->snapshot($playerId);
            if (($travelSnap['status'] ?? null) === 'traveling') {
                throw new RuntimeException('You are currently in flight. Wait for arrival before acting.');
            }

            $progression = new ProgressionService($this->database, $this->events);
            $progression->assertAvailable($playerId, 'foreign-market');

            $player = $this->requirePlayer($playerId);
            $progRow = $this->loadProgressionRow($playerId);
            $progState = $progRow['state'];
            $perks = $this->resolvePerks($playerId, $progState);
            $now = $this->now();
            $correlationId = bin2hex(random_bytes(16));

            if ($cleanAction === 'depart') {
                $destRaw = (string) ($payload['destination'] ?? $payload['city'] ?? $payload['hub'] ?? $payload['id'] ?? '');
                $hubId = self::resolveHubId($destRaw);
                if ($hubId === null) {
                    throw new InvalidArgumentException('Unknown foreign travel destination: ' . $destRaw);
                }
                if (!self::isHomeCity((string) $player['city'])) {
                    throw new RuntimeException('Return to Zone City before boarding a new international flight.');
                }

                $hub = self::HUBS[$hubId];
                $fare = $perks['hasAirstrip'] ? 0 : (int) $hub['fare'];
                $flightSeconds = $perks['hasAirstrip']
                    ? max(30, (int) round((int) $hub['flightSeconds'] * 0.70))
                    : (int) $hub['flightSeconds'];

                if ((int) $player['cash'] < $fare) {
                    throw new RuntimeException('Not enough cash on hand for international airfare ($' . number_format($fare) . ').');
                }
                if ($fare > 0) {
                    $newCash = (int) $player['cash'] - $fare;
                    $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
                    $this->ledger->record($playerId, 'cash', -$fare, $newCash, 'foreign-market.fare:' . $hubId, $correlationId);
                }

                $trip = $this->travel->depart($playerId, (string) $player['city'], $hubId, $flightSeconds);
                $this->saveTripState($playerId, (int) $trip['version'], 0);

                $this->events->publish(new DomainEvent('PlayerTraveled', [
                    'playerId' => $playerId,
                    'city' => $hub['nameEn'],
                    'hubId' => $hubId,
                    'fare' => $fare,
                    'travelSeconds' => $flightSeconds,
                    'hasAirstrip' => $perks['hasAirstrip'],
                    'correlationId' => $correlationId,
                ]));

                return [
                    ...$this->snapshot($playerId),
                    'result' => [
                        'action' => 'depart',
                        'destination' => $hubId,
                        'farePaid' => $fare,
                        'flightSeconds' => $flightSeconds,
                        'hasAirstrip' => $perks['hasAirstrip'],
                        'correlationId' => $correlationId,
                    ],
                ];
            }

            if ($cleanAction === 'return') {
                if (self::isHomeCity((string) $player['city'])) {
                    throw new RuntimeException('You are already in Zone City.');
                }
                $hubId = self::resolveHubId((string) $player['city']);
                $baseSec = $hubId !== null ? (int) self::HUBS[$hubId]['flightSeconds'] : 300;
                $flightSeconds = $perks['hasAirstrip']
                    ? max(30, (int) round($baseSec * 0.70))
                    : $baseSec;

                $trip = $this->travel->depart($playerId, (string) $player['city'], 'Zone City', $flightSeconds);
                $this->saveTripState($playerId, (int) $trip['version'], 0);

                $this->events->publish(new DomainEvent('PlayerTraveled', [
                    'playerId' => $playerId,
                    'city' => 'Zone City',
                    'origin' => (string) $player['city'],
                    'fare' => 0,
                    'travelSeconds' => $flightSeconds,
                    'correlationId' => $correlationId,
                ]));

                return [
                    ...$this->snapshot($playerId),
                    'result' => [
                        'action' => 'return',
                        'destination' => 'Zone City',
                        'farePaid' => 0,
                        'flightSeconds' => $flightSeconds,
                        'correlationId' => $correlationId,
                    ],
                ];
            }

            if ($cleanAction === 'buy') {
                if (self::isHomeCity((string) $player['city']) || ($travelSnap !== null && ($travelSnap['status'] ?? '') !== 'arrived')) {
                    throw new RuntimeException('You can only purchase foreign smuggling stock when landed abroad.');
                }
                $hubId = self::resolveHubId((string) $player['city']);
                if ($hubId === null) {
                    throw new RuntimeException('No foreign market terminal operates in ' . $player['city'] . '.');
                }
                $itemId = strtolower(trim((string) ($payload['itemId'] ?? $payload['id'] ?? '')));
                if ($itemId === '' || !isset(self::HUBS[$hubId]['items'][$itemId])) {
                    throw new InvalidArgumentException('That item is not sold at the ' . self::HUBS[$hubId]['nameEn'] . ' market.');
                }
                $quantity = $this->parseQuantity($payload['quantity'] ?? null, 19);

                $travelVersion = (int) ($travelSnap['version'] ?? 0);
                $tripState = $this->loadTripState($playerId, $travelVersion);
                if ($tripState['bought'] + $quantity > $perks['capacity']) {
                    throw new RuntimeException(sprintf(
                        'Travel luggage capacity exceeded (%d/%d items used; %d requested).',
                        $tripState['bought'],
                        $perks['capacity'],
                        $quantity,
                    ));
                }

                $this->lockMetaKey(self::STOCK_META_KEY);
                $stocks = $this->loadOrRestockGlobal($now);
                $availableStock = max(0, (int) ($stocks[$hubId][$itemId] ?? 0));
                if ($availableStock < $quantity) {
                    throw new RuntimeException('Not enough global stock remaining in ' . self::HUBS[$hubId]['nameEn'] . ' (' . $availableStock . ' left).');
                }

                $unitPrice = (int) self::HUBS[$hubId]['items'][$itemId]['price'];
                $totalCost = $unitPrice * $quantity;
                if ((int) $player['cash'] < $totalCost) {
                    throw new RuntimeException('Not enough cash on hand ($' . number_format($totalCost) . ' required).');
                }

                $newCash = (int) $player['cash'] - $totalCost;
                $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
                $this->ledger->record($playerId, 'cash', -$totalCost, $newCash, 'foreign-market.buy:' . $hubId . ':' . $itemId, $correlationId);

                $stocks[$hubId][$itemId] = $availableStock - $quantity;
                $this->saveGlobalStocks($now, $stocks);

                $progState['inv'][$itemId] = (int) ($progState['inv'][$itemId] ?? 0) + $quantity;
                if (in_array($itemId, self::PLUSHIE_SET_KEYS, true)) {
                    $progState['plushies'] = is_array($progState['plushies'] ?? null) ? $progState['plushies'] : [];
                    $progState['plushies'][$itemId] = (int) ($progState['plushies'][$itemId] ?? 0) + $quantity;
                }
                $progState['ctr']['buys'] = (int) ($progState['ctr']['buys'] ?? 0) + $quantity;
                $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
                $this->ledger->record($playerId, 'item:' . $itemId, $quantity, (int) $progState['inv'][$itemId], 'foreign-market.buy', $correlationId);

                $newUsed = $tripState['bought'] + $quantity;
                $this->saveTripState($playerId, $travelVersion, $newUsed);

                $this->events->publish(new DomainEvent('ForeignItemPurchased', [
                    'playerId' => $playerId,
                    'hubId' => $hubId,
                    'itemId' => $itemId,
                    'quantity' => $quantity,
                    'unitPrice' => $unitPrice,
                    'totalCost' => $totalCost,
                    'stockRemaining' => $stocks[$hubId][$itemId],
                    'luggageUsed' => $newUsed,
                    'luggageCapacity' => $perks['capacity'],
                    'correlationId' => $correlationId,
                ]));

                return [
                    ...$this->snapshot($playerId),
                    'result' => [
                        'action' => 'buy',
                        'hubId' => $hubId,
                        'itemId' => $itemId,
                        'quantity' => $quantity,
                        'unitPrice' => $unitPrice,
                        'totalCost' => $totalCost,
                        'stockRemaining' => $stocks[$hubId][$itemId],
                        'luggageUsed' => $newUsed,
                        'luggageCapacity' => $perks['capacity'],
                        'correlationId' => $correlationId,
                    ],
                ];
            }

            // cleanAction === 'rehab'
            $hubId = self::resolveHubId((string) $player['city']);
            if ($hubId !== 'zurich' || ($travelSnap !== null && ($travelSnap['status'] ?? '') !== 'arrived')) {
                throw new RuntimeException('Fly to Zurich, Switzerland and land before entering the Rehab Clinic.');
            }
            $addiction = max((int) ($progState['addiction'] ?? 0), (int) ($progState['tornState']['addiction'] ?? 0));
            $overdoseCount = (int) ($progState['cooldowns']['overdoseCount'] ?? 0);
            if ($addiction <= 0 && $overdoseCount <= 0) {
                throw new RuntimeException('You have zero addiction and need no rehabilitation.');
            }
            $cost = max(10000, $addiction * 12000);
            if ((int) $player['cash'] < $cost) {
                throw new RuntimeException('Not enough cash for Zurich Rehab treatment ($' . number_format($cost) . ' required).');
            }

            $newCash = (int) $player['cash'] - $cost;
            $newHappy = min(max(250, (int) $player['max_happy']), (int) $player['happy'] + 250);
            $this->database->execute(
                'UPDATE players SET cash = :cash, happy = :happy WHERE id = :id',
                ['cash' => $newCash, 'happy' => $newHappy, 'id' => $playerId],
            );
            $this->ledger->record($playerId, 'cash', -$cost, $newCash, 'foreign-market.zurich-rehab', $correlationId);

            $progState['addiction'] = 0;
            $progState['tornState'] = is_array($progState['tornState'] ?? null) ? $progState['tornState'] : [];
            $progState['tornState']['addiction'] = 0;
            $progState['cooldowns'] = is_array($progState['cooldowns'] ?? null)
                ? $progState['cooldowns']
                : ['drugUntil' => 0, 'medicalUntil' => 0, 'boosterUntil' => 0, 'overdoseCount' => 0];
            $progState['cooldowns']['overdoseCount'] = 0;
            $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);

            $this->events->publish(new DomainEvent('ZurichRehabCompleted', [
                'playerId' => $playerId,
                'clearedAddiction' => $addiction,
                'cost' => $cost,
                'happyRestored' => $newHappy - (int) $player['happy'],
                'correlationId' => $correlationId,
            ]));

            return [
                ...$this->snapshot($playerId),
                'result' => [
                    'action' => 'rehab',
                    'clearedAddiction' => $addiction,
                    'cost' => $cost,
                    'happyRestored' => $newHappy - (int) $player['happy'],
                    'correlationId' => $correlationId,
                ],
            ];
        });
    }

    /** @return array<string, mixed> */
    private function resolvePerks(string $playerId, array $progState): array
    {
        $hasIsland = ($progState['prop'] ?? '') === 'island';
        $hasPilot = !empty($progState['tornState']['staff']['pilot']);
        $hasAirstrip = $hasIsland || $hasPilot;

        $family = (new FamilyProgressionService($this->database, $this->events))->snapshot($playerId);
        $hasSuitcase = !empty($progState['fac']['ups']['travel_cap'])
            || !empty($progState['tornState']['travel_cap'])
            || !empty($progState['tornState']['suitcase'])
            || ((int) ($progState['inv']['travel_cap'] ?? 0) > 0)
            || ((int) ($progState['inv']['large_suitcase'] ?? 0) > 0)
            || ((int) ($progState['inv']['suitcase'] ?? 0) > 0)
            || !empty($family['upgrades']['travel_cap']);

        $islandBonus = $hasAirstrip ? 10 : 0;
        $suitcaseBonus = $hasSuitcase ? 4 : 0;
        $capacity = 5 + $islandBonus + $suitcaseBonus;

        return [
            'hasIsland' => $hasIsland,
            'hasPilot' => $hasPilot,
            'hasAirstrip' => $hasAirstrip,
            'hasSuitcase' => $hasSuitcase,
            'flightTimeDiscountPct' => $hasAirstrip ? 30 : 0,
            'freeAirfare' => $hasAirstrip,
            'islandBonus' => $islandBonus,
            'suitcaseBonus' => $suitcaseBonus,
            'capacity' => $capacity,
        ];
    }

    /** @return array<string, array<string, int>> */
    private function defaultStocks(): array
    {
        $stocks = [];
        foreach (self::HUBS as $hubId => $hub) {
            $stocks[$hubId] = [];
            foreach ($hub['items'] as $itemId => $spec) {
                $stocks[$hubId][$itemId] = (int) $spec['baseStock'];
            }
        }
        return $stocks;
    }

    /** @return array<string, array<string, int>> */
    private function loadOrRestockGlobal(int $now): array
    {
        $window = intdiv($now, self::RESTOCK_WINDOW_SECONDS);
        $defaults = $this->defaultStocks();
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => self::STOCK_META_KEY]);
        if ($row !== null && isset($row['value'])) {
            $decoded = json_decode((string) $row['value'], true);
            if (is_array($decoded) && (int) ($decoded['window'] ?? -1) === $window && is_array($decoded['stocks'] ?? null)) {
                foreach ($defaults as $hubId => $items) {
                    if (is_array($decoded['stocks'][$hubId] ?? null)) {
                        foreach ($items as $itemId => $baseQty) {
                            if (isset($decoded['stocks'][$hubId][$itemId])) {
                                $defaults[$hubId][$itemId] = max(0, (int) $decoded['stocks'][$hubId][$itemId]);
                            }
                        }
                    }
                }
                return $defaults;
            }
        }
        $this->saveGlobalStocks($now, $defaults);
        return $defaults;
    }

    /** @param array<string, array<string, int>> $stocks */
    private function saveGlobalStocks(int $now, array $stocks): void
    {
        $payload = [
            'window' => intdiv($now, self::RESTOCK_WINDOW_SECONDS),
            'updatedAt' => gmdate('c', $now),
            'stocks' => $stocks,
        ];
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :value) ON CONFLICT (name) DO UPDATE SET value = :updated',
            ['name' => self::STOCK_META_KEY, 'value' => $encoded, 'updated' => $encoded],
        );
    }

    /** @return array{travelVersion: int, bought: int} */
    private function loadTripState(string $playerId, int $currentTravelVersion): array
    {
        $key = self::TRIP_META_PREFIX . substr(hash('sha256', $playerId), 0, 48);
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => $key]);
        if ($row === null || !isset($row['value'])) {
            return ['travelVersion' => $currentTravelVersion, 'bought' => 0];
        }
        $decoded = json_decode((string) $row['value'], true);
        if (!is_array($decoded) || (int) ($decoded['travelVersion'] ?? -1) !== $currentTravelVersion) {
            return ['travelVersion' => $currentTravelVersion, 'bought' => 0];
        }
        return [
            'travelVersion' => $currentTravelVersion,
            'bought' => max(0, (int) ($decoded['bought'] ?? 0)),
        ];
    }

    private function saveTripState(string $playerId, int $travelVersion, int $bought): void
    {
        $key = self::TRIP_META_PREFIX . substr(hash('sha256', $playerId), 0, 48);
        $encoded = json_encode(['travelVersion' => $travelVersion, 'bought' => max(0, $bought)], JSON_THROW_ON_ERROR);
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :value) ON CONFLICT (name) DO UPDATE SET value = :updated',
            ['name' => $key, 'value' => $encoded, 'updated' => $encoded],
        );
    }

    private function requirePlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Unknown player: ' . $playerId);
        }
        return $this->resources->normalize($row);
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

    private function now(): int
    {
        return $this->clock === null ? time() : (int) ($this->clock)();
    }

    private function parseQuantity(mixed $raw, int $max): int
    {
        if ($raw === null) {
            return 1;
        }
        if (is_int($raw)) {
            $qty = $raw;
        } elseif (is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1) {
            $qty = (int) trim($raw);
        } else {
            throw new InvalidArgumentException(sprintf('Purchase quantity must be a whole integer between 1 and %d.', $max));
        }
        if ($qty < 1 || $qty > $max) {
            throw new InvalidArgumentException(sprintf('Purchase quantity must be between 1 and %d.', $max));
        }
        return $qty;
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
}

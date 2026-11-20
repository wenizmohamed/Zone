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
 * ZONE v149 Syndicate Economy & Social Contracts:
 * - Direct 2-Player Safe Trade Escrow (`player-trades-v1`, atomic paired `playersTransaction`)
 * - 0%-Tax Personal Player Bazaars (`player-bazaars-v1`)
 * - Player-Directed Companies `1★-10★` (`player-companies-v1`, 8 Torn archetypes + Star Specials)
 * - Marriage & Spouse Property `max_happy` Sharing (`player-marriages-v1`)
 */
final class TradeBazaarCompanyService
{
    public const TRADES_META_KEY = 'player-trades-v1';
    public const BAZAARS_META_KEY = 'player-bazaars-v1';
    public const COMPANIES_META_KEY = 'player-companies-v1';
    public const MARRIAGES_META_KEY = 'player-marriages-v1';
    private const SEED_META_KEY = 'syndicate-economy-seed-v1';

    public const COMPANY_FOUND_COST = 500_000;
    public const MARRIAGE_RING_COST = 25_000;
    public const COMPANY_SHIFT_ENERGY = 15;

    /** @var array<int, int> Cumulative company XP required for each star rating 1★..10★ */
    public const STAR_THRESHOLDS = [
        1 => 0,
        2 => 80,
        3 => 200,
        4 => 360,
        5 => 560,
        6 => 820,
        7 => 1150,
        8 => 1550,
        9 => 2050,
        10 => 2650,
    ];

    /** @var array<string, array<string, mixed>> */
    public const COMPANY_ARCHETYPES = [
        'oil_rig' => [
            'id' => 'oil_rig',
            'nameEn' => 'Offshore Oil Rig',
            'nameAr' => 'منصة نفط بحرية',
            'primaryStat' => 'man',
            'secondaryStat' => 'end',
            'baseWage' => 8500,
            'baseRevenue' => 32000,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 3, 'nameEn' => 'Rig Rations (+35E)', 'nameAr' => 'إعاشة المنصة (+35 طاقة)', 'effect' => ['energy' => 35]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Hazard Pay ($75,000)', 'nameAr' => 'بدل مخاطر (75,000$)', 'effect' => ['cash' => 75000]],
                5 => ['star' => 5, 'costJp' => 8, 'nameEn' => 'Crude Futures ($160,000)', 'nameAr' => 'عقود الخام الآجلة (160,000$)', 'effect' => ['cash' => 160000]],
                7 => ['star' => 7, 'costJp' => 14, 'nameEn' => 'Executive Charter (1x FHC)', 'nameAr' => 'رحلة تنفيذية (قسيمة فندق)', 'effect' => ['item' => 'fhc', 'qty' => 1]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => 'Black Gold Dividend ($650k + 1 Merit)', 'nameAr' => 'عائد الذهب الأسود (650 ألف$ + جدارة)', 'effect' => ['cash' => 650000, 'merits' => 1]],
            ],
        ],
        'adult_novelties' => [
            'id' => 'adult_novelties',
            'nameEn' => 'Adult Novelties Boutique',
            'nameAr' => 'متجر الترفيه الليلي',
            'primaryStat' => 'int',
            'secondaryStat' => 'end',
            'baseWage' => 5200,
            'baseRevenue' => 19500,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 2, 'nameEn' => 'Backroom Stash (+250 Happy)', 'nameAr' => 'مخزون خلفي (+250 سعادة)', 'effect' => ['happy' => 250]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Velvet Box ($45,000 + 300 Happy)', 'nameAr' => 'صندوق المخمل (45,000$ + 300 سعادة)', 'effect' => ['cash' => 45000, 'happy' => 300]],
                5 => ['star' => 5, 'costJp' => 8, 'nameEn' => 'VIP Lounge (+1,000 Happy)', 'nameAr' => 'صالة كبار الشخصيات (+1,000 سعادة)', 'effect' => ['happy' => 1000]],
                7 => ['star' => 7, 'costJp' => 20, 'nameEn' => 'Free Erotic DVD (1x EDVD)', 'nameAr' => 'قرص ترفيهي مجاني (EDVD)', 'effect' => ['item' => 'edvd', 'qty' => 1]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => "Director's Cut (1x EDVD + 1,500 Happy)", 'nameAr' => 'نسخة المخرج (EDVD + 1,500 سعادة)', 'effect' => ['item' => 'edvd', 'qty' => 1, 'happy' => 1500]],
            ],
        ],
        'sweet_shop' => [
            'id' => 'sweet_shop',
            'nameEn' => 'Harbor Sweet Shop',
            'nameAr' => 'متجر حلويات المرفأ',
            'primaryStat' => 'man',
            'secondaryStat' => 'end',
            'baseWage' => 4200,
            'baseRevenue' => 14000,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 2, 'nameEn' => 'Sugar Rush (1x Lollipop + 150 Happy)', 'nameAr' => 'دفعة سكر (مصاصة + 150 سعادة)', 'effect' => ['item' => 'lollipop', 'qty' => 1, 'happy' => 150]],
                3 => ['star' => 3, 'costJp' => 4, 'nameEn' => 'Confectionery Crate ($30k + 2x Lollipop)', 'nameAr' => 'صندوق حلويات (30 ألف$ + مصاصتان)', 'effect' => ['cash' => 30000, 'item' => 'lollipop', 'qty' => 2]],
                5 => ['star' => 5, 'costJp' => 10, 'nameEn' => 'Syndicate Energy Can (1x Energy Can)', 'nameAr' => 'عبوة طاقة مركزة', 'effect' => ['item' => 'energydrink', 'qty' => 1]],
                7 => ['star' => 7, 'costJp' => 15, 'nameEn' => 'Glucose Overdrive (+100 Energy)', 'nameAr' => 'فورة الجلوكوز (+100 طاقة)', 'effect' => ['energy' => 100]],
                10 => ['star' => 10, 'costJp' => 22, 'nameEn' => 'Golden Ticket (1x Energy Can + 150E)', 'nameAr' => 'التذكرة الذهبية (عبوة طاقة + 150 طاقة)', 'effect' => ['item' => 'energydrink', 'qty' => 1, 'energy' => 150]],
            ],
        ],
        'logistics_corp' => [
            'id' => 'logistics_corp',
            'nameEn' => 'Port Logistics & Freight',
            'nameAr' => 'شركة الشحن واللوجستيات',
            'primaryStat' => 'man',
            'secondaryStat' => 'int',
            'baseWage' => 6800,
            'baseRevenue' => 25000,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 2, 'nameEn' => 'Express Manifest (+30 Energy)', 'nameAr' => 'بيان شحن سريع (+30 طاقة)', 'effect' => ['energy' => 30]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Contraband Crate (1x Bolt Cutters + $35k)', 'nameAr' => 'صندوق مهربات (قاطع أقفال + 35 ألف$)', 'effect' => ['item' => 'bolt_cutters', 'qty' => 1, 'cash' => 35000]],
                5 => ['star' => 5, 'costJp' => 8, 'nameEn' => 'Customs Rebate ($110,000)', 'nameAr' => 'استرداد جمركي (110,000$)', 'effect' => ['cash' => 110000]],
                7 => ['star' => 7, 'costJp' => 14, 'nameEn' => 'Air Freight Fuel (+125 Energy)', 'nameAr' => 'وقود شحن جوي (+125 طاقة)', 'effect' => ['energy' => 125]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => 'Global Supply Chain (1x FHC + $200k)', 'nameAr' => 'سلسلة إمداد عالمية (قسيمة فندق + 200 ألف$)', 'effect' => ['item' => 'fhc', 'qty' => 1, 'cash' => 200000]],
            ],
        ],
        'private_security' => [
            'id' => 'private_security',
            'nameEn' => 'Private Security PMC',
            'nameAr' => 'شركة الأمن العسكري الخاص',
            'primaryStat' => 'man',
            'secondaryStat' => 'end',
            'baseWage' => 7400,
            'baseRevenue' => 27000,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 3, 'nameEn' => 'Ballistic Drill (+30 STR & +30 DEF)', 'nameAr' => 'تدريب باليستي (+30 قوة ودفاع)', 'effect' => ['battleStats' => ['strength' => 30, 'defense' => 30]]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Tactical Issue (2x Flash Grenade)', 'nameAr' => 'صرف تكتيكي (قنبلتان ضوئيتان)', 'effect' => ['item' => 'flash_grenade', 'qty' => 2]],
                5 => ['star' => 5, 'costJp' => 9, 'nameEn' => 'Armory Vest (1x Kevlar Vest + 60 DEF)', 'nameAr' => 'سترة دروع (+60 دفاع)', 'effect' => ['item' => 'vest', 'qty' => 1, 'battleStats' => ['defense' => 60]]],
                7 => ['star' => 7, 'costJp' => 15, 'nameEn' => 'Combat Stim (1x Epinephrine + 90 STR)', 'nameAr' => 'محفز قتالي (إبينفرين + 90 قوة)', 'effect' => ['item' => 'epinephrine', 'qty' => 1, 'battleStats' => ['strength' => 90]]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => 'Warlord Retainer ($350k + 150 All Stats)', 'nameAr' => 'عقد القائد (350 ألف$ + 150 لكل الصفات)', 'effect' => ['cash' => 350000, 'battleStats' => ['strength' => 150, 'defense' => 150, 'speed' => 150, 'dexterity' => 150]]],
            ],
        ],
        'cyber_defense' => [
            'id' => 'cyber_defense',
            'nameEn' => 'Cyber Defense Syndicate',
            'nameAr' => 'شركة الأمن السيبراني',
            'primaryStat' => 'int',
            'secondaryStat' => 'end',
            'baseWage' => 7800,
            'baseRevenue' => 29000,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 2, 'nameEn' => 'Zero-Day Script (+40 Crime XP & +8 Nerve)', 'nameAr' => 'ثغرة يوم الصفر (+40 خبرة جريمة و8 أعصاب)', 'effect' => ['crimeXp' => 40, 'nerve' => 8]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Hardware Rig (1x High-Speed Drive + $45k)', 'nameAr' => 'عتاد اختراق (قرص سريع + 45 ألف$)', 'effect' => ['item' => 'high_speed_drive', 'qty' => 1, 'cash' => 45000]],
                5 => ['star' => 5, 'costJp' => 8, 'nameEn' => 'Warrant Wipe (1x Lawyer Card)', 'nameAr' => 'مسح المذكرة (بطاقة محامي)', 'effect' => ['item' => 'lawyer_card', 'qty' => 1]],
                7 => ['star' => 7, 'costJp' => 14, 'nameEn' => 'Crypto Mixer ($190,000 + 15 Nerve)', 'nameAr' => 'خلاط رقمي (190,000$ + 15 أعصاب)', 'effect' => ['cash' => 190000, 'nerve' => 15]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => 'Sovereign Rootkit ($400k + 1x Xanax)', 'nameAr' => 'اختراق سيادي (400 ألف$ + زاناكس)', 'effect' => ['cash' => 400000, 'item' => 'xanax', 'qty' => 1, 'crimeXp' => 100]],
            ],
        ],
        'tv_network' => [
            'id' => 'tv_network',
            'nameEn' => 'Zone City TV Network',
            'nameAr' => 'شبكة تلفزيون الزون',
            'primaryStat' => 'int',
            'secondaryStat' => 'end',
            'baseWage' => 7000,
            'baseRevenue' => 26500,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 2, 'nameEn' => 'Press Pass (+10 Nerve & +200 Happy)', 'nameAr' => 'بطاقة صحافة (+10 أعصاب و200 سعادة)', 'effect' => ['nerve' => 10, 'happy' => 200]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Prime-Time Cut ($60,000)', 'nameAr' => 'حصة البث الذهبي (60,000$)', 'effect' => ['cash' => 60000]],
                5 => ['star' => 5, 'costJp' => 9, 'nameEn' => 'Propaganda Spin (+60 Respect & +400 Happy)', 'nameAr' => 'دعاية إعلامية (+60 احترام و400 سعادة)', 'effect' => ['respect' => 60, 'happy' => 400]],
                7 => ['star' => 7, 'costJp' => 15, 'nameEn' => 'Exposé Dossier (1x Lawyer Card + $150k)', 'nameAr' => 'ملف استقصائي (بطاقة محامي + 150 ألف$)', 'effect' => ['item' => 'lawyer_card', 'qty' => 1, 'cash' => 150000]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => 'Broadcast Monopoly ($480k + 160 Respect)', 'nameAr' => 'احتكار البث (480 ألف$ + 160 احترام)', 'effect' => ['cash' => 480000, 'respect' => 160]],
            ],
        ],
        'fitness_center' => [
            'id' => 'fitness_center',
            'nameEn' => 'Apex Fitness Center',
            'nameAr' => 'مركز اللياقة المتقدم',
            'primaryStat' => 'man',
            'secondaryStat' => 'end',
            'baseWage' => 5800,
            'baseRevenue' => 21000,
            'specials' => [
                1 => ['star' => 1, 'costJp' => 2, 'nameEn' => 'Protein Shake (+40 Energy)', 'nameAr' => 'مخفوق بروتين (+40 طاقة)', 'effect' => ['energy' => 40]],
                3 => ['star' => 3, 'costJp' => 5, 'nameEn' => 'Personal Coach (+60 Gym XP & +40 SPD/DEX)', 'nameAr' => 'مدرب شخصي (+60 خبرة نادي و40 سرعة/رشاقة)', 'effect' => ['gymXp' => 60, 'battleStats' => ['speed' => 40, 'dexterity' => 40]]],
                5 => ['star' => 5, 'costJp' => 9, 'nameEn' => 'Adrenal Cycle (1x Epinephrine + 80 STR)', 'nameAr' => 'دورة أدرينالين (إبينفرين + 80 قوة)', 'effect' => ['item' => 'epinephrine', 'qty' => 1, 'battleStats' => ['strength' => 80]]],
                7 => ['star' => 7, 'costJp' => 15, 'nameEn' => 'Cryo Recovery (1x Blood Bag + 120E)', 'nameAr' => 'استشفاء تبريدي (كيس دم + 120 طاقة)', 'effect' => ['item' => 'bloodbag', 'qty' => 1, 'energy' => 120]],
                10 => ['star' => 10, 'costJp' => 25, 'nameEn' => 'Olympic Conditioning (+250 All Stats & +150 Gym XP)', 'nameAr' => 'تأهيل أولمبي (+250 لكل الصفات و150 خبرة نادي)', 'effect' => ['gymXp' => 150, 'battleStats' => ['strength' => 250, 'defense' => 250, 'speed' => 250, 'dexterity' => 250]]],
            ],
        ],
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
    ) {
        $this->ledger = new Ledger($database);
        $this->notifications = new NotificationService($database);
        $this->resources = new ResourceService($database, $this->notifications);
        $this->leveling = new LevelingService($database, $this->ledger, $events);
        $this->daily = new DailyService($database, $this->ledger, $events, $this->leveling, $clock);
    }

    public function snapshot(string $playerId): array
    {
        $this->ensureSeeded();
        $this->resources->regenerate($playerId);
        $this->syncSpouseHappinessIfMarried($playerId);
        $player = $this->requirePlayer($playerId);
        [$state] = $this->loadProgression($playerId);

        $tradesDoc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
        $bazaarsDoc = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);
        $companiesDoc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
        $marriagesDoc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);

        // Player's open/recent trades
        $myTrades = [];
        foreach ($tradesDoc['trades'] ?? [] as $trade) {
            if (($trade['initiatorId'] ?? '') === $playerId || ($trade['partnerId'] ?? '') === $playerId) {
                $myTrades[] = $this->formatTrade($trade, $playerId);
            }
        }
        usort($myTrades, static fn (array $a, array $b): int => strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? '')));

        // Personal Bazaar & Public Directory
        $myShop = $bazaarsDoc['shops'][$playerId] ?? [
            'sellerId' => $playerId,
            'sellerName' => (string) $player['username'],
            'open' => false,
            'tagline' => '0% Tax Personal Syndicate Bazaar',
            'totalSalesCash' => 0,
        ];
        $myListings = [];
        $publicListings = [];
        foreach ($bazaarsDoc['listings'] ?? [] as $listing) {
            if (($listing['status'] ?? '') !== 'active' || (int) ($listing['quantity'] ?? 0) <= 0) {
                continue;
            }
            $sellerId = (string) ($listing['sellerId'] ?? '');
            $shopOpen = (bool) ($bazaarsDoc['shops'][$sellerId]['open'] ?? true);
            $formatted = [
                ...$listing,
                'totalPrice' => (int) $listing['quantity'] * (int) $listing['unitPrice'],
                'taxRatePct' => 0,
                'shopOpen' => $shopOpen,
                'tagline' => (string) ($bazaarsDoc['shops'][$sellerId]['tagline'] ?? ''),
            ];
            if ($sellerId === $playerId) {
                $myListings[] = $formatted;
            }
            if ($shopOpen) {
                $publicListings[] = $formatted;
            }
        }

        // Companies Directory & Active Company
        $activeCompanyId = $this->findPlayerCompanyId($playerId, $state, $companiesDoc);
        $myCompany = null;
        $companyDirectory = [];
        foreach ($companiesDoc['companies'] ?? [] as $cid => $comp) {
            if (($comp['status'] ?? 'active') !== 'active') {
                continue;
            }
            $formattedComp = $this->formatCompany($comp, $playerId);
            $companyDirectory[] = $formattedComp;
            if ($cid === $activeCompanyId) {
                $myCompany = $formattedComp;
            }
        }

        // Marriage & Proposals
        $activeMarriage = $this->findActiveMarriage($playerId, $marriagesDoc);
        $incomingProposals = [];
        $outgoingProposals = [];
        foreach ($marriagesDoc['proposals'] ?? [] as $prop) {
            if (($prop['status'] ?? '') !== 'pending') {
                continue;
            }
            if (($prop['targetPlayerId'] ?? '') === $playerId) {
                $incomingProposals[] = $prop;
            } elseif (($prop['proposerId'] ?? '') === $playerId) {
                $outgoingProposals[] = $prop;
            }
        }

        $inventoryList = [];
        foreach (($state['inv'] ?? []) as $itemId => $qty) {
            if ((int) $qty > 0) {
                $inventoryList[] = ['itemId' => (string) $itemId, 'quantity' => (int) $qty];
            }
        }

        $workStats = is_array($state['workStats'] ?? null) ? $state['workStats'] : ['man' => 0, 'int' => 0, 'end' => 0];

        $spouseInfo = $activeMarriage !== null ? $this->formatMarriageForPlayer($activeMarriage, $playerId) : null;
        if ($myCompany !== null) {
            $myCompany['jobPts'] = (int) ($state['jobPts'] ?? 0);
        }
        $archetypesList = array_values(array_map(static fn (array $a): array => [
            'id' => $a['id'],
            'nameEn' => $a['nameEn'],
            'nameAr' => $a['nameAr'],
            'primaryStat' => $a['primaryStat'],
            'secondaryStat' => $a['secondaryStat'],
            'baseWage' => $a['baseWage'],
            'specials' => array_values($a['specials']),
        ], self::COMPANY_ARCHETYPES));

        return [
            'levelGates' => TornSystemsService::buildLevelGates((int) $player['level']),
            'player' => [
                'id' => (string) $player['id'],
                'username' => (string) $player['username'],
                'level' => (int) $player['level'],
                'cash' => (int) $player['cash'],
                'energy' => (int) $player['energy'],
                'maxEnergy' => (int) $player['max_energy'],
                'happy' => (int) $player['happy'],
                'maxHappy' => (int) $player['max_happy'],
                'jobPts' => (int) ($state['jobPts'] ?? 0),
                'activePropertyId' => (string) ($state['prop'] ?? 'shack'),
                'workStats' => [
                    'man' => (int) ($workStats['man'] ?? 0),
                    'int' => (int) ($workStats['int'] ?? 0),
                    'end' => (int) ($workStats['end'] ?? 0),
                ],
            ],
            'jobPts' => (int) ($state['jobPts'] ?? 0),
            'inventory' => $inventoryList,
            'trades' => [
                'active' => array_values(array_filter($myTrades, static fn (array $t): bool => $t['status'] === 'open')),
                'history' => array_slice(array_values(array_filter($myTrades, static fn (array $t): bool => $t['status'] !== 'open')), 0, 10),
            ],
            'bazaarListings' => array_values($publicListings),
            'bazaar' => [
                'open' => (bool) ($myShop['open'] ?? false),
                'tagline' => (string) ($myShop['tagline'] ?? ''),
                'taxRatePct' => 0,
                'myShop' => $myShop,
                'myListings' => array_values($myListings),
                'listings' => array_values($publicListings),
                'directory' => array_values($publicListings),
            ],
            'company' => $myCompany,
            'myCompany' => $myCompany,
            'companies' => array_values($companyDirectory),
            'companyArchetypes' => $archetypesList,
            'companyRegistry' => [
                'foundCostCash' => self::COMPANY_FOUND_COST,
                'shiftEnergyCost' => self::COMPANY_SHIFT_ENERGY,
                'jobPoints' => (int) ($state['jobPts'] ?? 0),
                'myCompany' => $myCompany,
                'directory' => array_values($companyDirectory),
                'archetypes' => $archetypesList,
            ],
            'marriage' => [
                'ringCostCash' => self::MARRIAGE_RING_COST,
                'married' => $activeMarriage !== null,
                'spouseId' => $spouseInfo['spouseId'] ?? null,
                'spouseName' => $spouseInfo['spouseName'] ?? null,
                'spouse' => $spouseInfo,
                'proposals' => array_values($incomingProposals),
                'incomingProposals' => array_values($incomingProposals),
                'outgoingProposals' => array_values($outgoingProposals),
            ],
            'serverTime' => gmdate('c', $this->now()),
        ];
    }

    public function act(string $playerId, string $action, array $payload = []): array
    {
        $this->ensureSeeded();
        $cleanAction = trim($action);
        if ($cleanAction === '') {
            throw new InvalidArgumentException('Syndicate economy action is required.');
        }

        if ($cleanAction === 'company.workShift') {
            (new TravelService($this->database, $this->events, $this->clock))->assertAvailable($playerId);
            (new ProgressionService($this->database, $this->events))->assertAvailable($playerId, $cleanAction);
        }

        $actingPlayer = $this->requirePlayer($playerId);
        $actingLevel = (int) $actingPlayer['level'];
        if (str_starts_with($cleanAction, 'bazaar.')) {
            TornSystemsService::assertLevelUnlocked($actingLevel, 5, 'Personal Bazaars');
        } elseif (str_starts_with($cleanAction, 'trade.')) {
            TornSystemsService::assertLevelUnlocked($actingLevel, 5, '2-Player Direct Trades');
        } elseif (in_array($cleanAction, ['company.found', 'company.join'], true)) {
            TornSystemsService::assertLevelUnlocked($actingLevel, 10, 'Player Companies');
        }

        $receipt = match ($cleanAction) {
            'trade.create' => $this->createTrade($playerId, $payload),
            'trade.addCash' => $this->addTradeCash($playerId, $payload),
            'trade.addItem' => $this->addTradeItem($playerId, $payload),
            'trade.accept' => $this->acceptTrade($playerId, $payload),
            'trade.cancel' => $this->cancelTrade($playerId, $payload),
            'bazaar.toggle' => $this->toggleBazaar($playerId, $payload),
            'bazaar.listItem' => $this->listBazaarItem($playerId, $payload),
            'bazaar.unlistItem' => $this->unlistBazaarItem($playerId, $payload),
            'bazaar.buy' => $this->buyBazaarItem($playerId, $payload),
            'company.found' => $this->foundCompany($playerId, $payload),
            'company.join' => $this->joinCompany($playerId, $payload),
            'company.leave' => $this->leaveCompany($playerId),
            'company.manage' => $this->manageCompany($playerId, $payload),
            'company.workShift' => $this->workCompanyShift($playerId),
            'company.redeemSpecial' => $this->redeemCompanySpecial($playerId, $payload),
            'marriage.propose' => $this->proposeMarriage($playerId, $payload),
            'marriage.accept' => $this->acceptMarriage($playerId, $payload),
            'marriage.divorce' => $this->divorceMarriage($playerId),
            default => throw new InvalidArgumentException("Unsupported syndicate economy action: {$cleanAction}"),
        };

        if (getenv('ZONE_EPHEMERAL_VERCEL_SQLITE') === '1') {
            SyndicateSocialService::refreshEphemeralLedgerCookie($this->database, $this->events, $playerId);
        }

        return [
            'action' => $cleanAction,
            'result' => $receipt,
            ...$this->snapshot($playerId),
        ];
    }

    // ==================================================================
    // 1. Direct 2-Player Safe Trade Escrow (`player-trades-v1`)
    // ==================================================================

    private function createTrade(string $playerId, array $payload): array
    {
        $partnerQuery = trim((string) ($payload['partnerId'] ?? $payload['targetPlayerId'] ?? $payload['partner'] ?? $payload['target'] ?? ''));
        if ($partnerQuery === '') {
            throw new InvalidArgumentException('Trade partner player ID or username is required.');
        }
        $partner = $this->resolveTargetPlayer($partnerQuery);
        $partnerId = (string) $partner['id'];
        if ($partnerId === $playerId) {
            throw new InvalidArgumentException('Cannot open a 2-player trade escrow with yourself.');
        }

        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playersTransaction([$playerId, $partnerId], function () use ($playerId, $partnerId, $correlationId): array {
            $this->lockMetaKey(self::TRADES_META_KEY, '{"trades":{}}');
            $doc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
            $p1 = $this->requirePlayer($playerId);
            $p2 = $this->requirePlayer($partnerId);
            $now = $this->now();
            $nowIso = gmdate('c', $now);

            $tradeId = 'trd-' . bin2hex(random_bytes(8));
            $trade = [
                'id' => $tradeId,
                'initiatorId' => $playerId,
                'initiatorName' => (string) $p1['username'],
                'partnerId' => $partnerId,
                'partnerName' => (string) $p2['username'],
                'status' => 'open',
                'escrow' => [
                    $playerId => ['cash' => 0, 'items' => []],
                    $partnerId => ['cash' => 0, 'items' => []],
                ],
                'accepted' => [
                    $playerId => false,
                    $partnerId => false,
                ],
                'createdAt' => $nowIso,
                'updatedAt' => $nowIso,
                'expiresAt' => $now + 21600,
            ];
            $doc['trades'][$tradeId] = $trade;
            $this->saveMetaDoc(self::TRADES_META_KEY, $doc);

            $this->pushNotification($partnerId, 'trade.opened', [
                'tradeId' => $tradeId,
                'initiatorId' => $playerId,
                'initiatorName' => (string) $p1['username'],
                'message_en' => sprintf('%s opened a safe trade escrow with you.', (string) $p1['username']),
                'message_ar' => sprintf('فتح %s نافذة تبادل آمن معك.', (string) $p1['username']),
            ]);

            $this->events->publish(new DomainEvent('TradeCreated', [
                'tradeId' => $tradeId,
                'initiatorId' => $playerId,
                'partnerId' => $partnerId,
                'correlationId' => $correlationId,
            ]));

            return $this->formatTrade($trade, $playerId);
        });
    }

    private function addTradeCash(string $playerId, array $payload): array
    {
        $tradeId = trim((string) ($payload['tradeId'] ?? $payload['id'] ?? ''));
        $amount = $this->parseBoundedInt($payload['amount'] ?? 0, 1, 2_000_000_000, 'trade cash amount');
        [$p1, $p2] = $this->lookupTradeParticipants($tradeId);
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playersTransaction([$p1, $p2], function () use ($playerId, $tradeId, $amount, $p1, $p2, $correlationId): array {
            $this->lockMetaKey(self::TRADES_META_KEY, '{"trades":{}}');
            $doc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
            $trade = &$this->requireOpenTradeForParticipant($doc, $tradeId, $playerId);

            $player = $this->requirePlayer($playerId);
            if ((int) $player['cash'] < $amount) {
                throw new RuntimeException('Not enough cash on hand to escrow into trade.');
            }
            $newCash = (int) $player['cash'] - $amount;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
            $this->ledger->record($playerId, 'cash', -$amount, $newCash, 'trade.escrow.cash', $correlationId);

            $trade['escrow'][$playerId]['cash'] = (int) ($trade['escrow'][$playerId]['cash'] ?? 0) + $amount;
            // Torn anti-scam reset: changing any trade offer resets acceptance flags on both sides.
            $trade['accepted'][$p1] = false;
            $trade['accepted'][$p2] = false;
            $trade['updatedAt'] = gmdate('c', $this->now());
            $this->saveMetaDoc(self::TRADES_META_KEY, $doc);

            $this->events->publish(new DomainEvent('TradeCashEscrowed', [
                'tradeId' => $tradeId,
                'playerId' => $playerId,
                'amount' => $amount,
                'correlationId' => $correlationId,
            ]));

            return $this->formatTrade($trade, $playerId);
        });
    }

    private function addTradeItem(string $playerId, array $payload): array
    {
        $tradeId = trim((string) ($payload['tradeId'] ?? $payload['id'] ?? ''));
        $itemId = trim((string) ($payload['itemId'] ?? ''));
        $quantity = $this->parseBoundedInt($payload['quantity'] ?? $payload['qty'] ?? 1, 1, 1000, 'trade item quantity');
        $this->assertCatalogItem($itemId);
        [$p1, $p2] = $this->lookupTradeParticipants($tradeId);
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playersTransaction([$p1, $p2], function () use ($playerId, $tradeId, $itemId, $quantity, $p1, $p2, $correlationId): array {
            $this->lockMetaKey(self::TRADES_META_KEY, '{"trades":{}}');
            $doc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
            $trade = &$this->requireOpenTradeForParticipant($doc, $tradeId, $playerId);

            $progression = new ProgressionService($this->database, $this->events);
            $progression->escrowInventory($playerId, $itemId, -$quantity, 'trade.escrow.item', $correlationId);

            $trade['escrow'][$playerId]['items'] = is_array($trade['escrow'][$playerId]['items'] ?? null) ? $trade['escrow'][$playerId]['items'] : [];
            $trade['escrow'][$playerId]['items'][$itemId] = (int) ($trade['escrow'][$playerId]['items'][$itemId] ?? 0) + $quantity;
            $trade['accepted'][$p1] = false;
            $trade['accepted'][$p2] = false;
            $trade['updatedAt'] = gmdate('c', $this->now());
            $this->saveMetaDoc(self::TRADES_META_KEY, $doc);

            $this->events->publish(new DomainEvent('TradeItemEscrowed', [
                'tradeId' => $tradeId,
                'playerId' => $playerId,
                'itemId' => $itemId,
                'quantity' => $quantity,
                'correlationId' => $correlationId,
            ]));

            return $this->formatTrade($trade, $playerId);
        });
    }

    private function acceptTrade(string $playerId, array $payload): array
    {
        $tradeId = trim((string) ($payload['tradeId'] ?? $payload['id'] ?? ''));
        [$p1, $p2] = $this->lookupTradeParticipants($tradeId);
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playersTransaction([$p1, $p2], function () use ($playerId, $tradeId, $p1, $p2, $correlationId): array {
            $this->lockMetaKey(self::TRADES_META_KEY, '{"trades":{}}');
            $doc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
            $trade = &$this->requireOpenTradeForParticipant($doc, $tradeId, $playerId);

            $trade['accepted'][$playerId] = true;
            $nowIso = gmdate('c', $this->now());
            $trade['updatedAt'] = $nowIso;

            $bothAccepted = !empty($trade['accepted'][$p1]) && !empty($trade['accepted'][$p2]);
            if ($bothAccepted) {
                $progression = new ProgressionService($this->database, $this->events);

                // Transfer p1's escrowed cash & items -> p2, and p2's escrowed cash & items -> p1
                foreach ([[$p1, $p2], [$p2, $p1]] as [$fromId, $toId]) {
                    $escrowCash = max(0, (int) ($trade['escrow'][$fromId]['cash'] ?? 0));
                    if ($escrowCash > 0) {
                        $recipient = $this->requirePlayer($toId);
                        $newCash = (int) $recipient['cash'] + $escrowCash;
                        $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $toId]);
                        $this->ledger->record($toId, 'cash', $escrowCash, $newCash, 'trade.settle.cash', $correlationId);
                    }
                    $escrowItems = is_array($trade['escrow'][$fromId]['items'] ?? null) ? $trade['escrow'][$fromId]['items'] : [];
                    foreach ($escrowItems as $itemId => $qty) {
                        $q = (int) $qty;
                        if ($q > 0) {
                            $progression->escrowInventory($toId, (string) $itemId, $q, 'trade.settle.item', $correlationId);
                        }
                    }
                }

                $trade['status'] = 'completed';
                $trade['completedAt'] = $nowIso;
                $this->saveMetaDoc(self::TRADES_META_KEY, $doc);

                $this->pushNotification($p1, 'trade.completed', [
                    'tradeId' => $tradeId,
                    'counterpartyName' => $trade['partnerName'],
                    'message_en' => sprintf('Safe trade %s with %s settled atomically.', $tradeId, $trade['partnerName']),
                    'message_ar' => sprintf('اكتملت صفقة التبادل الآمن %s مع %s.', $tradeId, $trade['partnerName']),
                ]);
                $this->pushNotification($p2, 'trade.completed', [
                    'tradeId' => $tradeId,
                    'counterpartyName' => $trade['initiatorName'],
                    'message_en' => sprintf('Safe trade %s with %s settled atomically.', $tradeId, $trade['initiatorName']),
                    'message_ar' => sprintf('اكتملت صفقة التبادل الآمن %s مع %s.', $tradeId, $trade['initiatorName']),
                ]);

                $this->daily->recordProgress($p1, 'trades', 1);
                $this->daily->recordProgress($p2, 'trades', 1);

                $this->events->publish(new DomainEvent('TradeCompleted', [
                    'tradeId' => $tradeId,
                    'initiatorId' => $p1,
                    'partnerId' => $p2,
                    'correlationId' => $correlationId,
                ]));
            } else {
                $this->saveMetaDoc(self::TRADES_META_KEY, $doc);
            }

            return $this->formatTrade($trade, $playerId);
        });
    }

    private function cancelTrade(string $playerId, array $payload): array
    {
        $tradeId = trim((string) ($payload['tradeId'] ?? $payload['id'] ?? ''));
        [$p1, $p2] = $this->lookupTradeParticipants($tradeId);
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playersTransaction([$p1, $p2], function () use ($playerId, $tradeId, $p1, $p2, $correlationId): array {
            $this->lockMetaKey(self::TRADES_META_KEY, '{"trades":{}}');
            $doc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
            $trade = &$this->requireOpenTradeForParticipant($doc, $tradeId, $playerId);

            $progression = new ProgressionService($this->database, $this->events);
            foreach ([$p1, $p2] as $ownerId) {
                $refundCash = max(0, (int) ($trade['escrow'][$ownerId]['cash'] ?? 0));
                if ($refundCash > 0) {
                    $owner = $this->requirePlayer($ownerId);
                    $newCash = (int) $owner['cash'] + $refundCash;
                    $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $ownerId]);
                    $this->ledger->record($ownerId, 'cash', $refundCash, $newCash, 'trade.refund.cash', $correlationId);
                }
                $escrowItems = is_array($trade['escrow'][$ownerId]['items'] ?? null) ? $trade['escrow'][$ownerId]['items'] : [];
                foreach ($escrowItems as $itemId => $qty) {
                    $q = (int) $qty;
                    if ($q > 0) {
                        $progression->escrowInventory($ownerId, (string) $itemId, $q, 'trade.refund.item', $correlationId);
                    }
                }
            }

            $nowIso = gmdate('c', $this->now());
            $trade['status'] = 'cancelled';
            $trade['cancelledBy'] = $playerId;
            $trade['cancelledAt'] = $nowIso;
            $trade['updatedAt'] = $nowIso;
            $this->saveMetaDoc(self::TRADES_META_KEY, $doc);

            $otherId = $playerId === $p1 ? $p2 : $p1;
            $this->pushNotification($otherId, 'trade.cancelled', [
                'tradeId' => $tradeId,
                'cancelledBy' => $playerId,
                'message_en' => sprintf('Trade %s was cancelled; all escrowed cash and items were refunded.', $tradeId),
                'message_ar' => sprintf('أُلغيت صفقة التبادل %s وأُعيدت جميع الأموال والعناصر المحجوزة.', $tradeId),
            ]);

            $this->events->publish(new DomainEvent('TradeCancelled', [
                'tradeId' => $tradeId,
                'cancelledBy' => $playerId,
                'correlationId' => $correlationId,
            ]));

            return $this->formatTrade($trade, $playerId);
        });
    }

    // ==================================================================
    // 2. 0%-Tax Personal Player Bazaars (`player-bazaars-v1`)
    // ==================================================================

    private function toggleBazaar(string $playerId, array $payload): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $payload): array {
            $player = $this->requirePlayer($playerId);
            $this->lockMetaKey(self::BAZAARS_META_KEY, '{"shops":{},"listings":{}}');
            $doc = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);

            $existing = $doc['shops'][$playerId] ?? [
                'sellerId' => $playerId,
                'sellerName' => (string) $player['username'],
                'open' => false,
                'tagline' => '0% Tax Personal Syndicate Bazaar',
                'totalSalesCash' => 0,
            ];
            $open = array_key_exists('open', $payload) ? (bool) $payload['open'] : !$existing['open'];
            $tagline = isset($payload['tagline']) ? trim((string) $payload['tagline']) : (string) $existing['tagline'];
            if ($tagline === '') {
                $tagline = '0% Tax Personal Syndicate Bazaar';
            }
            $tagline = $this->utf8Slice($tagline, 120);

            $existing['open'] = $open;
            $existing['tagline'] = $tagline;
            $existing['sellerName'] = (string) $player['username'];
            $doc['shops'][$playerId] = $existing;
            $this->saveMetaDoc(self::BAZAARS_META_KEY, $doc);

            return $existing;
        });
    }

    private function listBazaarItem(string $playerId, array $payload): array
    {
        $itemId = trim((string) ($payload['itemId'] ?? $payload['id'] ?? ''));
        $quantity = $this->parseBoundedInt($payload['quantity'] ?? $payload['qty'] ?? 1, 1, 1000, 'bazaar quantity');
        $unitPrice = $this->parseBoundedInt($payload['unitPrice'] ?? $payload['price'] ?? 0, 1, 1_000_000_000, 'unit price');
        $this->assertCatalogItem($itemId);
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playerTransaction($playerId, function () use ($playerId, $itemId, $quantity, $unitPrice, $correlationId): array {
            $player = $this->requirePlayer($playerId);
            $progression = new ProgressionService($this->database, $this->events);
            $progression->escrowInventory($playerId, $itemId, -$quantity, 'bazaar.escrow.list', $correlationId);

            $this->lockMetaKey(self::BAZAARS_META_KEY, '{"shops":{},"listings":{}}');
            $doc = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);
            if (!isset($doc['shops'][$playerId])) {
                $doc['shops'][$playerId] = [
                    'sellerId' => $playerId,
                    'sellerName' => (string) $player['username'],
                    'open' => true,
                    'tagline' => (string) $player['username'] . "'s 0%-Tax Bazaar",
                    'totalSalesCash' => 0,
                ];
            }

            $listingId = 'bz-' . bin2hex(random_bytes(8));
            $listing = [
                'id' => $listingId,
                'sellerId' => $playerId,
                'sellerName' => (string) $player['username'],
                'itemId' => $itemId,
                'quantity' => $quantity,
                'unitPrice' => $unitPrice,
                'status' => 'active',
                'createdAt' => gmdate('c', $this->now()),
            ];
            $doc['listings'][$listingId] = $listing;
            $this->saveMetaDoc(self::BAZAARS_META_KEY, $doc);

            $this->events->publish(new DomainEvent('BazaarItemListed', [
                'listingId' => $listingId,
                'sellerId' => $playerId,
                'itemId' => $itemId,
                'quantity' => $quantity,
                'unitPrice' => $unitPrice,
                'correlationId' => $correlationId,
            ]));

            return $listing;
        });
    }

    private function unlistBazaarItem(string $playerId, array $payload): array
    {
        $listingId = trim((string) ($payload['listingId'] ?? $payload['id'] ?? ''));
        if ($listingId === '') {
            throw new InvalidArgumentException('Bazaar listing ID is required.');
        }
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playerTransaction($playerId, function () use ($playerId, $listingId, $correlationId): array {
            $this->lockMetaKey(self::BAZAARS_META_KEY, '{"shops":{},"listings":{}}');
            $doc = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);
            $listing = $doc['listings'][$listingId] ?? null;
            if ($listing === null || ($listing['status'] ?? '') !== 'active' || (int) ($listing['quantity'] ?? 0) <= 0) {
                throw new RuntimeException('Bazaar listing is no longer active.');
            }
            if (($listing['sellerId'] ?? '') !== $playerId) {
                throw new RuntimeException('Only the bazaar owner can unlist this item.');
            }

            $qty = (int) $listing['quantity'];
            $itemId = (string) $listing['itemId'];
            $doc['listings'][$listingId]['quantity'] = 0;
            $doc['listings'][$listingId]['status'] = 'unlisted';
            $this->saveMetaDoc(self::BAZAARS_META_KEY, $doc);

            $progression = new ProgressionService($this->database, $this->events);
            $progression->escrowInventory($playerId, $itemId, $qty, 'bazaar.escrow.unlist', $correlationId);

            return [
                'listingId' => $listingId,
                'itemId' => $itemId,
                'refundedQuantity' => $qty,
            ];
        });
    }

    private function buyBazaarItem(string $playerId, array $payload): array
    {
        $listingId = trim((string) ($payload['listingId'] ?? $payload['id'] ?? ''));
        $quantity = $this->parseBoundedInt($payload['quantity'] ?? $payload['qty'] ?? 1, 1, 1000, 'buy quantity');

        $previewDoc = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);
        $previewListing = $previewDoc['listings'][$listingId] ?? null;
        if ($previewListing === null) {
            throw new RuntimeException('Unknown bazaar listing.');
        }
        $sellerId = (string) ($previewListing['sellerId'] ?? '');
        if ($sellerId === '' || $sellerId === $playerId) {
            throw new RuntimeException('Cannot purchase from your own personal bazaar.');
        }

        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playersTransaction([$playerId, $sellerId], function () use ($playerId, $sellerId, $listingId, $quantity, $correlationId): array {
            $this->lockMetaKey(self::BAZAARS_META_KEY, '{"shops":{},"listings":{}}');
            $doc = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);
            $listing = &$doc['listings'][$listingId];
            if (!is_array($listing) || ($listing['status'] ?? '') !== 'active') {
                throw new RuntimeException('This bazaar listing is no longer active.');
            }
            $shopOpen = (bool) ($doc['shops'][$sellerId]['open'] ?? true);
            if (!$shopOpen) {
                throw new RuntimeException("Seller's personal bazaar is currently closed.");
            }
            $availableQty = (int) ($listing['quantity'] ?? 0);
            if ($availableQty < $quantity) {
                throw new RuntimeException("Only {$availableQty} unit(s) remain in this bazaar listing.");
            }

            $unitPrice = (int) $listing['unitPrice'];
            $totalPrice = $unitPrice * $quantity; // 0% market tax!
            $buyer = $this->requirePlayer($playerId);
            if ((int) $buyer['cash'] < $totalPrice) {
                throw new RuntimeException('Not enough cash to purchase from this bazaar.');
            }
            $seller = $this->requirePlayer($sellerId);

            $buyerCashAfter = (int) $buyer['cash'] - $totalPrice;
            $sellerCashAfter = (int) $seller['cash'] + $totalPrice;

            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $buyerCashAfter, 'id' => $playerId]);
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $sellerCashAfter, 'id' => $sellerId]);
            $this->ledger->record($playerId, 'cash', -$totalPrice, $buyerCashAfter, 'bazaar.buy', $correlationId);
            $this->ledger->record($sellerId, 'cash', $totalPrice, $sellerCashAfter, 'bazaar.sale', $correlationId);

            $itemId = (string) $listing['itemId'];
            $progression = new ProgressionService($this->database, $this->events);
            $progression->escrowInventory($playerId, $itemId, $quantity, 'bazaar.buy.item', $correlationId);
            $progression->recordMetric($playerId, 'buys', $quantity);

            $listing['quantity'] = $availableQty - $quantity;
            if ($listing['quantity'] <= 0) {
                $listing['status'] = 'sold';
            }
            $doc['shops'][$sellerId]['totalSalesCash'] = (int) ($doc['shops'][$sellerId]['totalSalesCash'] ?? 0) + $totalPrice;
            $this->saveMetaDoc(self::BAZAARS_META_KEY, $doc);

            $this->daily->recordProgress($playerId, 'buys', $quantity);
            $this->daily->recordProgress($playerId, 'trades', 1);

            $this->pushNotification($sellerId, 'bazaar.sale', [
                'listingId' => $listingId,
                'buyerName' => (string) $buyer['username'],
                'itemId' => $itemId,
                'quantity' => $quantity,
                'proceedsCash' => $totalPrice,
                'taxPaid' => 0,
                'message_en' => sprintf('%s bought %dx %s from your bazaar for $%s (0%% tax).', (string) $buyer['username'], $quantity, $itemId, number_format($totalPrice)),
                'message_ar' => sprintf('اشترى %s عدد %d من %s من بازارك مقابل %s$ (0%% ضريبة).', (string) $buyer['username'], $quantity, $itemId, number_format($totalPrice)),
            ]);

            $this->events->publish(new DomainEvent('BazaarItemPurchased', [
                'listingId' => $listingId,
                'buyerId' => $playerId,
                'sellerId' => $sellerId,
                'itemId' => $itemId,
                'quantity' => $quantity,
                'unitPrice' => $unitPrice,
                'totalPrice' => $totalPrice,
                'taxPaid' => 0,
                'sellerProceeds' => $totalPrice,
                'correlationId' => $correlationId,
            ]));

            return [
                'listingId' => $listingId,
                'sellerId' => $sellerId,
                'itemId' => $itemId,
                'quantity' => $quantity,
                'unitPrice' => $unitPrice,
                'totalPaid' => $totalPrice,
                'taxPaid' => 0,
                'sellerProceeds' => $totalPrice,
            ];
        });
    }

    // ==================================================================
    // 3. Player-Directed Companies (`1★-10★`) (`player-companies-v1`)
    // ==================================================================

    private function foundCompany(string $playerId, array $payload): array
    {
        $type = strtolower(trim((string) ($payload['type'] ?? $payload['archetype'] ?? '')));
        $arch = self::COMPANY_ARCHETYPES[$type] ?? null;
        if ($arch === null) {
            throw new InvalidArgumentException("Unknown company archetype: {$type}");
        }
        $name = trim(preg_replace('/\s+/u', ' ', (string) ($payload['name'] ?? '')) ?? '');
        if ($this->utf8Length($name) < 2 || $this->utf8Length($name) > 60) {
            throw new InvalidArgumentException('Company name must be between 2 and 60 characters.');
        }

        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playerTransaction($playerId, function () use ($playerId, $type, $arch, $name, $correlationId): array {
            $player = $this->requirePlayer($playerId);
            if ((int) $player['cash'] < self::COMPANY_FOUND_COST) {
                throw new RuntimeException('Need $500,000 cash to incorporate a Player-Directed Company.');
            }

            $this->lockMetaKey(self::COMPANIES_META_KEY, '{"companies":{}}');
            $doc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            [$state, $version] = $this->loadProgression($playerId);

            $existingCid = $this->findPlayerCompanyId($playerId, $state, $doc);
            if ($existingCid !== null && (($doc['companies'][$existingCid]['directorId'] ?? '') === $playerId)) {
                throw new RuntimeException('You already direct an active company. Leave or transfer it first.');
            }
            if ($existingCid !== null) {
                unset($doc['companies'][$existingCid]['employees'][$playerId]);
            }

            $newCash = (int) $player['cash'] - self::COMPANY_FOUND_COST;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
            $this->ledger->record($playerId, 'cash', -self::COMPANY_FOUND_COST, $newCash, 'company.found', $correlationId);

            $companyId = 'cmp-' . bin2hex(random_bytes(6));
            $nowIso = gmdate('c', $this->now());
            $company = [
                'id' => $companyId,
                'type' => $type,
                'name' => $name,
                'directorId' => $playerId,
                'directorName' => (string) $player['username'],
                'stars' => 1,
                'companyXp' => 0,
                'revenue' => 0,
                'adBudget' => 5000,
                'servicePrice' => 100,
                'status' => 'active',
                'employees' => [
                    $playerId => [
                        'playerId' => $playerId,
                        'username' => (string) $player['username'],
                        'role' => 'director',
                        'wage' => (int) $arch['baseWage'],
                        'shifts' => 0,
                        'joinedAt' => $nowIso,
                    ],
                ],
                'createdAt' => $nowIso,
            ];
            $doc['companies'][$companyId] = $company;
            $this->saveMetaDoc(self::COMPANIES_META_KEY, $doc);

            $state['companyId'] = $companyId;
            $this->saveProgression($playerId, $state, $version + 1);

            $this->events->publish(new DomainEvent('CompanyFounded', [
                'companyId' => $companyId,
                'directorId' => $playerId,
                'type' => $type,
                'name' => $name,
                'costCash' => self::COMPANY_FOUND_COST,
                'correlationId' => $correlationId,
            ]));

            return $this->formatCompany($company, $playerId);
        });
    }

    private function joinCompany(string $playerId, array $payload): array
    {
        $companyId = trim((string) ($payload['companyId'] ?? $payload['id'] ?? ''));
        if ($companyId === '') {
            throw new InvalidArgumentException('Company ID is required.');
        }

        return $this->database->playerTransaction($playerId, function () use ($playerId, $companyId): array {
            $player = $this->requirePlayer($playerId);
            $this->lockMetaKey(self::COMPANIES_META_KEY, '{"companies":{}}');
            $doc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            $company = &$doc['companies'][$companyId];
            if (!is_array($company) || ($company['status'] ?? '') !== 'active') {
                throw new RuntimeException('That company is not actively hiring.');
            }
            if (count($company['employees'] ?? []) >= 12 && !isset($company['employees'][$playerId])) {
                throw new RuntimeException('This company has reached its 12-employee roster limit.');
            }

            [$state, $version] = $this->loadProgression($playerId);
            $prevCid = $this->findPlayerCompanyId($playerId, $state, $doc);
            if ($prevCid !== null && $prevCid !== $companyId) {
                if (($doc['companies'][$prevCid]['directorId'] ?? '') === $playerId) {
                    throw new RuntimeException('Step down from directing your current company (`company.leave`) before joining another.');
                }
                unset($doc['companies'][$prevCid]['employees'][$playerId]);
            }

            $arch = self::COMPANY_ARCHETYPES[$company['type']] ?? self::COMPANY_ARCHETYPES['oil_rig'];
            if (!isset($company['employees'][$playerId])) {
                $company['employees'][$playerId] = [
                    'playerId' => $playerId,
                    'username' => (string) $player['username'],
                    'role' => ($company['directorId'] === $playerId) ? 'director' : 'employee',
                    'wage' => (int) $arch['baseWage'],
                    'shifts' => 0,
                    'joinedAt' => gmdate('c', $this->now()),
                ];
            }
            $this->saveMetaDoc(self::COMPANIES_META_KEY, $doc);

            $state['companyId'] = $companyId;
            $this->saveProgression($playerId, $state, $version + 1);

            return $this->formatCompany($company, $playerId);
        });
    }

    private function leaveCompany(string $playerId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->lockMetaKey(self::COMPANIES_META_KEY, '{"companies":{}}');
            $doc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            [$state, $version] = $this->loadProgression($playerId);

            $companyId = $this->findPlayerCompanyId($playerId, $state, $doc);
            if ($companyId === null || !isset($doc['companies'][$companyId])) {
                throw new RuntimeException('You are not currently employed by a player company.');
            }

            $company = &$doc['companies'][$companyId];
            unset($company['employees'][$playerId]);

            if (($company['directorId'] ?? '') === $playerId) {
                if (!empty($company['employees'])) {
                    $nextDirectorId = (string) array_key_first($company['employees']);
                    $company['directorId'] = $nextDirectorId;
                    $company['directorName'] = (string) ($company['employees'][$nextDirectorId]['username'] ?? 'Director');
                    $company['employees'][$nextDirectorId]['role'] = 'director';
                } else {
                    $company['status'] = 'closed';
                }
            }

            $this->saveMetaDoc(self::COMPANIES_META_KEY, $doc);
            $state['companyId'] = null;
            $this->saveProgression($playerId, $state, $version + 1);

            return ['leftCompanyId' => $companyId, 'companyStatus' => $company['status']];
        });
    }

    private function manageCompany(string $playerId, array $payload): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $payload): array {
            $this->lockMetaKey(self::COMPANIES_META_KEY, '{"companies":{}}');
            $doc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            [$state] = $this->loadProgression($playerId);

            $companyId = $this->findPlayerCompanyId($playerId, $state, $doc);
            if ($companyId === null || !isset($doc['companies'][$companyId])) {
                throw new RuntimeException('You are not enrolled in an active company.');
            }
            $company = &$doc['companies'][$companyId];
            if (($company['directorId'] ?? '') !== $playerId) {
                throw new RuntimeException('Only the Company Director can adjust ad budget and service pricing.');
            }

            if (array_key_exists('adBudget', $payload)) {
                $company['adBudget'] = $this->parseBoundedInt($payload['adBudget'], 0, 1_000_000, 'advertising budget');
            }
            if (array_key_exists('servicePrice', $payload)) {
                $company['servicePrice'] = $this->parseBoundedInt($payload['servicePrice'], 10, 10_000, 'service price');
            }
            $this->saveMetaDoc(self::COMPANIES_META_KEY, $doc);

            return $this->formatCompany($company, $playerId);
        });
    }

    private function workCompanyShift(string $playerId): array
    {
        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playerTransaction($playerId, function () use ($playerId, $correlationId): array {
            $this->resources->regenerate($playerId);
            $player = $this->requirePlayer($playerId);
            if ((int) $player['energy'] < self::COMPANY_SHIFT_ENERGY) {
                throw new RuntimeException('Need 15 Energy to work a company shift.');
            }

            $this->lockMetaKey(self::COMPANIES_META_KEY, '{"companies":{}}');
            $doc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            [$state, $version] = $this->loadProgression($playerId);

            $companyId = $this->findPlayerCompanyId($playerId, $state, $doc);
            if ($companyId === null || !isset($doc['companies'][$companyId])) {
                throw new RuntimeException('Join or found a Company before working a company shift.');
            }
            $company = &$doc['companies'][$companyId];
            $arch = self::COMPANY_ARCHETYPES[$company['type']] ?? self::COMPANY_ARCHETYPES['oil_rig'];

            $ws = is_array($state['workStats'] ?? null) ? $state['workStats'] : ['man' => 0, 'int' => 0, 'end' => 0];
            $pStat = (string) $arch['primaryStat'];
            $sStat = (string) $arch['secondaryStat'];
            $statScore = ((int) ($ws[$pStat] ?? 0) * 2) + (int) ($ws[$sStat] ?? 0);

            $adFactor = 1.0 + min(0.50, ((int) ($company['adBudget'] ?? 5000)) / 50_000);
            $priceDelta = abs(110 - (int) ($company['servicePrice'] ?? 100));
            $priceEfficiency = max(0.75, 1.15 - ($priceDelta / 400));

            $mods = TornSystemsService::extractLiveModifiers($state);
            $mogulJobMult = 1.0 + (((int) $mods['jobPayBonusPct']) / 100.0);
            $starsBefore = max(1, min(10, (int) ($company['stars'] ?? 1)));
            $shiftRevenue = (int) round(((int) $arch['baseRevenue'] + ($starsBefore * 3500) + ($statScore * 12)) * $adFactor * $priceEfficiency);
            $wagePaid = (int) round(((int) $arch['baseWage'] + ($starsBefore * 1600) + ($statScore * 5)) * (!empty($state['eduDone']['biz']) ? 1.10 : 1.0) * $mogulJobMult);
            $companyXpGain = max(45, (int) round(55 * $adFactor * $priceEfficiency + min(45, $statScore / 20)));

            $company['revenue'] = (int) ($company['revenue'] ?? 0) + $shiftRevenue;
            $company['companyXp'] = (int) ($company['companyXp'] ?? 0) + $companyXpGain;
            $company['stars'] = self::starsForCompanyXp((int) $company['companyXp']);
            $company['employees'][$playerId]['shifts'] = (int) ($company['employees'][$playerId]['shifts'] ?? 0) + 1;
            $this->saveMetaDoc(self::COMPANIES_META_KEY, $doc);

            // Train working stats (MAN / INT / END)
            $gains = ['man' => 4, 'int' => 4, 'end' => 4];
            $gains[$pStat] = 14;
            $gains[$sStat] = 9;
            if (!empty($state['eduDone']['gen'])) {
                foreach ($gains as $k => $v) {
                    $gains[$k] = (int) round($v * 1.2);
                }
            }
            $state['workStats'] = [
                'man' => (int) ($ws['man'] ?? 0) + $gains['man'],
                'int' => (int) ($ws['int'] ?? 0) + $gains['int'],
                'end' => (int) ($ws['end'] ?? 0) + $gains['end'],
            ];

            $jpEarned = 3 + intdiv((int) $company['stars'], 3);
            $state['jobPts'] = max(0, (int) ($state['jobPts'] ?? 0)) + $jpEarned;
            $state['ctr']['shifts'] = (int) ($state['ctr']['shifts'] ?? 0) + 1;
            $this->ledger->record($playerId, 'job_points', $jpEarned, (int) $state['jobPts'], 'company.shift.jp', $correlationId);

            $xpEarned = 20 + ((int) $company['stars'] * 6);
            $newCash = (int) $player['cash'] + $wagePaid;
            $newXp = (int) $player['xp'] + $xpEarned;
            $this->database->execute(
                'UPDATE players SET energy = energy - :energy, cash = :cash, xp = :xp WHERE id = :id',
                ['energy' => self::COMPANY_SHIFT_ENERGY, 'cash' => $newCash, 'xp' => $newXp, 'id' => $playerId],
            );
            $this->ledger->record($playerId, 'cash', $wagePaid, $newCash, 'company.shift.wage', $correlationId);
            $this->saveProgression($playerId, $state, $version + 1);

            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->daily->recordProgress($playerId, 'job_cash', $wagePaid);
            $this->daily->recordProgress($playerId, 'shifts', 1);

            $this->events->publish(new DomainEvent('CompanyShiftWorked', [
                'companyId' => $companyId,
                'playerId' => $playerId,
                'wagePaid' => $wagePaid,
                'revenueGenerated' => $shiftRevenue,
                'jobPtsEarned' => $jpEarned,
                'starsBefore' => $starsBefore,
                'starsAfter' => $company['stars'],
                'workStatsGained' => $gains,
                'correlationId' => $correlationId,
            ]));

            return [
                'companyId' => $companyId,
                'energySpent' => self::COMPANY_SHIFT_ENERGY,
                'wagePaid' => $wagePaid,
                'revenueGenerated' => $shiftRevenue,
                'companyXpGained' => $companyXpGain,
                'starsBefore' => $starsBefore,
                'starsAfter' => (int) $company['stars'],
                'jobPtsEarned' => $jpEarned,
                'jobPtsBalance' => (int) $state['jobPts'],
                'workStatsGained' => $gains,
                'workStats' => $state['workStats'],
                'levelUp' => $levelUp,
            ];
        });
    }

    private function redeemCompanySpecial(string $playerId, array $payload): array
    {
        $star = $this->parseBoundedInt($payload['star'] ?? $payload['tier'] ?? $payload['specialStar'] ?? 1, 1, 10, 'company star tier');
        if (!in_array($star, [1, 3, 5, 7, 10], true)) {
            throw new InvalidArgumentException('Company specials unlock at 1★, 3★, 5★, 7★, and 10★.');
        }

        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playerTransaction($playerId, function () use ($playerId, $star, $correlationId): array {
            $player = $this->requirePlayer($playerId);
            $doc = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            [$state, $version] = $this->loadProgression($playerId);

            $companyId = $this->findPlayerCompanyId($playerId, $state, $doc);
            if ($companyId === null || !isset($doc['companies'][$companyId])) {
                throw new RuntimeException('Join a company to redeem Company Star Specials.');
            }
            $company = $doc['companies'][$companyId];
            $currentStars = max(1, (int) ($company['stars'] ?? 1));
            if ($currentStars < $star) {
                throw new RuntimeException("Company must reach {$star}★ to unlock this special (currently {$currentStars}★).");
            }

            $arch = self::COMPANY_ARCHETYPES[$company['type']] ?? self::COMPANY_ARCHETYPES['oil_rig'];
            $special = $arch['specials'][$star];
            $costJp = (int) $special['costJp'];
            $availableJp = max(0, (int) ($state['jobPts'] ?? 0));
            if ($availableJp < $costJp) {
                throw new RuntimeException("Need {$costJp} Job Points to redeem {$special['nameEn']} (you have {$availableJp}).");
            }

            $state['jobPts'] = $availableJp - $costJp;
            $this->ledger->record($playerId, 'job_points', -$costJp, (int) $state['jobPts'], 'company.special.' . $star, $correlationId);

            $effect = $special['effect'];
            $cashAwarded = (int) ($effect['cash'] ?? 0);
            $energyAdd = (int) ($effect['energy'] ?? 0);
            $nerveAdd = (int) ($effect['nerve'] ?? 0);
            $happyAdd = (int) ($effect['happy'] ?? 0);
            $bStats = is_array($effect['battleStats'] ?? null) ? $effect['battleStats'] : [];

            $newCash = (int) $player['cash'] + $cashAwarded;
            $newEnergy = min(1000, (int) $player['energy'] + $energyAdd);
            $newNerve = min(500, (int) $player['nerve'] + $nerveAdd);
            $newHappy = min(99999, (int) $player['happy'] + $happyAdd);
            $newStr = (int) $player['strength'] + (int) ($bStats['strength'] ?? 0);
            $newDef = (int) $player['defense'] + (int) ($bStats['defense'] ?? 0);
            $newSpd = (int) $player['speed'] + (int) ($bStats['speed'] ?? 0);
            $newDex = (int) $player['dexterity'] + (int) ($bStats['dexterity'] ?? 0);

            $this->database->execute(
                'UPDATE players SET cash = :cash, energy = :energy, nerve = :nerve, happy = :happy, strength = :str, defense = :def, speed = :spd, dexterity = :dex WHERE id = :id',
                [
                    'cash' => $newCash,
                    'energy' => $newEnergy,
                    'nerve' => $newNerve,
                    'happy' => $newHappy,
                    'str' => $newStr,
                    'def' => $newDef,
                    'spd' => $newSpd,
                    'dex' => $newDex,
                    'id' => $playerId,
                ],
            );
            if ($cashAwarded > 0) {
                $this->ledger->record($playerId, 'cash', $cashAwarded, $newCash, 'company.special.cash', $correlationId);
            }

            $itemGranted = null;
            if (!empty($effect['item'])) {
                $itemId = (string) $effect['item'];
                $qty = max(1, (int) ($effect['qty'] ?? 1));
                $this->assertCatalogItem($itemId);
                $state['inv'][$itemId] = max(0, (int) ($state['inv'][$itemId] ?? 0)) + $qty;
                $this->ledger->record($playerId, 'item:' . $itemId, $qty, (int) $state['inv'][$itemId], 'company.special.item', $correlationId);
                $itemGranted = ['itemId' => $itemId, 'quantity' => $qty];
            }
            if (!empty($effect['merits'])) {
                $m = (int) $effect['merits'];
                $state['merits'] = max(0, (int) ($state['merits'] ?? 0)) + $m;
                $this->ledger->record($playerId, 'merits', $m, (int) $state['merits'], 'company.special.merits', $correlationId);
            }
            if (!empty($effect['crimeXp'])) {
                $state['crimeXp'] = (int) ($state['crimeXp'] ?? 0) + (int) $effect['crimeXp'];
            }
            if (!empty($effect['gymXp'])) {
                $state['gymXp'] = (int) ($state['gymXp'] ?? 0) + (int) $effect['gymXp'];
            }
            if (!empty($effect['respect'])) {
                $state['fac']['respect'] = (int) ($state['fac']['respect'] ?? 0) + (int) $effect['respect'];
            }

            $this->saveProgression($playerId, $state, $version + 1);

            $this->events->publish(new DomainEvent('CompanySpecialRedeemed', [
                'companyId' => $companyId,
                'playerId' => $playerId,
                'star' => $star,
                'specialName' => $special['nameEn'],
                'jobPtsSpent' => $costJp,
                'correlationId' => $correlationId,
            ]));

            return [
                'companyId' => $companyId,
                'star' => $star,
                'specialNameEn' => $special['nameEn'],
                'specialNameAr' => $special['nameAr'],
                'jobPtsSpent' => $costJp,
                'jobPtsBalance' => (int) $state['jobPts'],
                'cashAwarded' => $cashAwarded,
                'itemGranted' => $itemGranted,
            ];
        });
    }

    public static function starsForCompanyXp(int $xp): int
    {
        $stars = 1;
        foreach (self::STAR_THRESHOLDS as $star => $threshold) {
            if ($xp >= $threshold) {
                $stars = $star;
            }
        }
        return $stars;
    }

    // ==================================================================
    // 4. Marriage & Spouse Property Sharing (`player-marriages-v1`)
    // ==================================================================

    private function proposeMarriage(string $playerId, array $payload): array
    {
        $targetQuery = trim((string) ($payload['targetPlayerId'] ?? $payload['partnerId'] ?? $payload['target'] ?? ''));
        if ($targetQuery === '') {
            throw new InvalidArgumentException('Target spouse player ID or username is required.');
        }
        $target = $this->resolveTargetPlayer($targetQuery);
        $targetId = (string) $target['id'];
        if ($targetId === $playerId) {
            throw new InvalidArgumentException('Cannot propose marriage to yourself.');
        }

        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playersTransaction([$playerId, $targetId], function () use ($playerId, $targetId, $correlationId): array {
            $this->lockMetaKey(self::MARRIAGES_META_KEY, '{"proposals":{},"marriages":{}}');
            $doc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);

            if ($this->findActiveMarriage($playerId, $doc) !== null) {
                throw new RuntimeException('You are already married. Divorce before proposing again.');
            }
            if ($this->findActiveMarriage($targetId, $doc) !== null) {
                throw new RuntimeException('That operative is already married.');
            }

            $proposer = $this->requirePlayer($playerId);
            $partner = $this->requirePlayer($targetId);
            if ((int) $proposer['cash'] < self::MARRIAGE_RING_COST) {
                throw new RuntimeException('Need $25,000 cash for the engagement ring.');
            }

            $newCash = (int) $proposer['cash'] - self::MARRIAGE_RING_COST;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
            $this->ledger->record($playerId, 'cash', -self::MARRIAGE_RING_COST, $newCash, 'marriage.ring', $correlationId);

            $proposalId = 'mar-' . bin2hex(random_bytes(6));
            $proposal = [
                'id' => $proposalId,
                'proposerId' => $playerId,
                'proposerName' => (string) $proposer['username'],
                'targetPlayerId' => $targetId,
                'targetPlayerName' => (string) $partner['username'],
                'ringCostCash' => self::MARRIAGE_RING_COST,
                'status' => 'pending',
                'createdAt' => gmdate('c', $this->now()),
            ];
            $doc['proposals'][$proposalId] = $proposal;
            $this->saveMetaDoc(self::MARRIAGES_META_KEY, $doc);

            $this->pushNotification($targetId, 'marriage.proposal', [
                'proposalId' => $proposalId,
                'proposerId' => $playerId,
                'proposerName' => (string) $proposer['username'],
                'message_en' => sprintf('%s proposed marriage to you with a $25,000 Diamond Ring!', (string) $proposer['username']),
                'message_ar' => sprintf('تقدّم %s للزواج منك بخاتم ألماس بقيمة 25,000$!', (string) $proposer['username']),
            ]);

            $this->events->publish(new DomainEvent('MarriageProposed', [
                'proposalId' => $proposalId,
                'proposerId' => $playerId,
                'targetPlayerId' => $targetId,
                'ringCostCash' => self::MARRIAGE_RING_COST,
                'correlationId' => $correlationId,
            ]));

            return $proposal;
        });
    }

    private function acceptMarriage(string $playerId, array $payload): array
    {
        $proposalId = trim((string) ($payload['proposalId'] ?? $payload['id'] ?? ''));
        $previewDoc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);
        if ($proposalId === '') {
            foreach ($previewDoc['proposals'] ?? [] as $pid => $prop) {
                if (($prop['targetPlayerId'] ?? '') === $playerId && ($prop['status'] ?? '') === 'pending') {
                    $proposalId = (string) $pid;
                    break;
                }
            }
        }
        $preview = $previewDoc['proposals'][$proposalId] ?? null;
        if ($preview === null) {
            throw new RuntimeException('No pending marriage proposal found.');
        }
        $proposerId = (string) $preview['proposerId'];
        $targetId = (string) $preview['targetPlayerId'];
        if ($targetId !== $playerId) {
            throw new RuntimeException('Only the recipient of the proposal can accept it.');
        }

        $correlationId = bin2hex(random_bytes(16));
        return $this->database->playersTransaction([$proposerId, $targetId], function () use ($proposalId, $proposerId, $targetId, $correlationId): array {
            $this->lockMetaKey(self::MARRIAGES_META_KEY, '{"proposals":{},"marriages":{}}');
            $doc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);
            $proposal = &$doc['proposals'][$proposalId];
            if (!is_array($proposal) || ($proposal['status'] ?? '') !== 'pending') {
                throw new RuntimeException('Marriage proposal is no longer pending.');
            }
            if ($this->findActiveMarriage($proposerId, $doc) !== null || $this->findActiveMarriage($targetId, $doc) !== null) {
                throw new RuntimeException('One of the participants is already married.');
            }

            $nowIso = gmdate('c', $this->now());
            $proposal['status'] = 'accepted';
            $marriageId = 'wed-' . bin2hex(random_bytes(6));
            $p1 = $this->requirePlayer($proposerId);
            $p2 = $this->requirePlayer($targetId);

            [$state1, $v1] = $this->loadProgression($proposerId);
            [$state2, $v2] = $this->loadProgression($targetId);

            $p1Cap = $this->ownPropertyHappyCapacity($p1, $state1);
            $p2Cap = $this->ownPropertyHappyCapacity($p2, $state2);
            $sharedMaxHappy = max($p1Cap, $p2Cap, (int) $p1['max_happy'], (int) $p2['max_happy']);
            $sharedPropId = $p1Cap >= $p2Cap ? (string) ($state1['prop'] ?? 'shack') : (string) ($state2['prop'] ?? 'shack');

            $this->database->execute('UPDATE players SET max_happy = :mh WHERE id = :id', ['mh' => $sharedMaxHappy, 'id' => $proposerId]);
            $this->database->execute('UPDATE players SET max_happy = :mh WHERE id = :id', ['mh' => $sharedMaxHappy, 'id' => $targetId]);

            $state1['spouseId'] = $targetId;
            $state1['sharedPropertyHappy'] = $sharedMaxHappy;
            $state2['spouseId'] = $proposerId;
            $state2['sharedPropertyHappy'] = $sharedMaxHappy;
            $this->saveProgression($proposerId, $state1, $v1 + 1);
            $this->saveProgression($targetId, $state2, $v2 + 1);

            $marriage = [
                'id' => $marriageId,
                'proposalId' => $proposalId,
                'spouseAId' => $proposerId,
                'spouseAName' => (string) $p1['username'],
                'spouseBId' => $targetId,
                'spouseBName' => (string) $p2['username'],
                'sharedPropertyId' => $sharedPropId,
                'sharedMaxHappy' => $sharedMaxHappy,
                'status' => 'married',
                'marriedAt' => $nowIso,
            ];
            $doc['marriages'][$marriageId] = $marriage;
            $this->saveMetaDoc(self::MARRIAGES_META_KEY, $doc);

            $this->pushNotification($proposerId, 'marriage.accepted', [
                'marriageId' => $marriageId,
                'spouseId' => $targetId,
                'spouseName' => (string) $p2['username'],
                'sharedMaxHappy' => $sharedMaxHappy,
                'message_en' => sprintf('%s accepted your marriage proposal! Shared estate Max Happy is now %s.', (string) $p2['username'], number_format($sharedMaxHappy)),
                'message_ar' => sprintf('قبل %s عرض الزواج! الحد الأقصى للسعادة المشتركة أصبح %s.', (string) $p2['username'], number_format($sharedMaxHappy)),
            ]);

            $this->events->publish(new DomainEvent('MarriageAccepted', [
                'marriageId' => $marriageId,
                'spouseAId' => $proposerId,
                'spouseBId' => $targetId,
                'sharedPropertyId' => $sharedPropId,
                'sharedMaxHappy' => $sharedMaxHappy,
                'correlationId' => $correlationId,
            ]));

            return $marriage;
        });
    }

    private function divorceMarriage(string $playerId): array
    {
        $previewDoc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);
        $active = $this->findActiveMarriage($playerId, $previewDoc);
        if ($active === null) {
            throw new RuntimeException('You are not currently married.');
        }
        $p1Id = (string) $active['spouseAId'];
        $p2Id = (string) $active['spouseBId'];
        $marriageId = (string) $active['id'];
        $correlationId = bin2hex(random_bytes(16));

        return $this->database->playersTransaction([$p1Id, $p2Id], function () use ($playerId, $p1Id, $p2Id, $marriageId, $correlationId): array {
            $this->lockMetaKey(self::MARRIAGES_META_KEY, '{"proposals":{},"marriages":{}}');
            $doc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);
            if (!isset($doc['marriages'][$marriageId]) || ($doc['marriages'][$marriageId]['status'] ?? '') !== 'married') {
                throw new RuntimeException('Marriage is already dissolved.');
            }

            $doc['marriages'][$marriageId]['status'] = 'divorced';
            $doc['marriages'][$marriageId]['divorcedBy'] = $playerId;
            $doc['marriages'][$marriageId]['divorcedAt'] = gmdate('c', $this->now());
            $this->saveMetaDoc(self::MARRIAGES_META_KEY, $doc);

            foreach ([$p1Id, $p2Id] as $pid) {
                $pRow = $this->requirePlayer($pid);
                [$st, $ver] = $this->loadProgression($pid);
                unset($st['spouseId'], $st['sharedPropertyHappy']);
                $ownCap = $this->ownPropertyHappyCapacity($pRow, $st);
                $clampedHappy = min((int) $pRow['happy'], $ownCap);
                $this->database->execute(
                    'UPDATE players SET max_happy = :mh, happy = :h WHERE id = :id',
                    ['mh' => $ownCap, 'h' => $clampedHappy, 'id' => $pid],
                );
                $this->saveProgression($pid, $st, $ver + 1);
            }

            $otherId = $playerId === $p1Id ? $p2Id : $p1Id;
            $this->pushNotification($otherId, 'marriage.divorced', [
                'marriageId' => $marriageId,
                'divorcedBy' => $playerId,
                'message_en' => 'Your marriage was dissolved; shared property Max Happy reverted to your personal safehouse.',
                'message_ar' => 'تم فسخ الزواج وعاد الحد الأقصى للسعادة إلى عقارك الشخصي.',
            ]);

            $this->events->publish(new DomainEvent('MarriageDivorced', [
                'marriageId' => $marriageId,
                'divorcedBy' => $playerId,
                'correlationId' => $correlationId,
            ]));

            return [
                'marriageId' => $marriageId,
                'status' => 'divorced',
            ];
        });
    }

    private function syncSpouseHappinessIfMarried(string $playerId): void
    {
        $doc = $this->loadMetaDoc(self::MARRIAGES_META_KEY, ['proposals' => [], 'marriages' => []]);
        $active = $this->findActiveMarriage($playerId, $doc);
        if ($active === null) {
            return;
        }
        $p1Id = (string) $active['spouseAId'];
        $p2Id = (string) $active['spouseBId'];
        $this->database->playersTransaction([$p1Id, $p2Id], function () use ($p1Id, $p2Id): void {
            $p1 = $this->requirePlayer($p1Id);
            $p2 = $this->requirePlayer($p2Id);
            [$s1] = $this->loadProgression($p1Id);
            [$s2] = $this->loadProgression($p2Id);
            $shared = max(
                $this->ownPropertyHappyCapacity($p1, $s1),
                $this->ownPropertyHappyCapacity($p2, $s2),
                (int) $p1['max_happy'],
                (int) $p2['max_happy'],
            );
            if ((int) $p1['max_happy'] < $shared) {
                $this->database->execute('UPDATE players SET max_happy = :mh WHERE id = :id', ['mh' => $shared, 'id' => $p1Id]);
            }
            if ((int) $p2['max_happy'] < $shared) {
                $this->database->execute('UPDATE players SET max_happy = :mh WHERE id = :id', ['mh' => $shared, 'id' => $p2Id]);
            }
        });
    }

    private function ownPropertyHappyCapacity(array $player, array $state): int
    {
        $propId = (string) ($state['prop'] ?? 'shack');
        $catalog = (new GameplayCatalog($this->database, $this->events))->active();
        $propHappy = 250;
        foreach ($catalog['properties'] ?? [] as $entry) {
            if (($entry['id'] ?? '') === $propId) {
                $propHappy = (int) ($entry['happy'] ?? 250);
                break;
            }
        }
        if (!empty($state['tornState']['staff']['butler'])) {
            $propHappy += 250;
        }
        return max(250, $propHappy);
    }

    // ==================================================================
    // Seed & Formatting Helpers
    // ==================================================================

    private function ensureSeeded(): void
    {
        $flag = $this->database->fetchOne("SELECT value FROM engine_metadata WHERE name = :name", ['name' => self::SEED_META_KEY]);
        if (($flag['value'] ?? null) === '1') {
            return;
        }

        $this->database->transaction(function (): void {
            $this->lockMetaKey(self::SEED_META_KEY, '0');
            $recheck = $this->database->fetchOne("SELECT value FROM engine_metadata WHERE name = :name", ['name' => self::SEED_META_KEY]);
            if (($recheck['value'] ?? null) === '1') {
                return;
            }

            $nowIso = gmdate('c', $this->now());
            $today = gmdate('Y-m-d', $this->now());

            // Ensure NPC peers exist so 0%-tax bazaar & company interactions work out-of-the-box
            $this->database->insertIgnore(
                'players',
                ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
                ['npc-night-broker', 'NadiaQuick', 17, 8650, 128000, 120, 45, 2050, 1000, 120, 45, 2050, 1000, $nowIso, 1850, 1650, 2400, 2150, 620000, 'Zone City', 6, $today],
            );
            $this->database->insertIgnore(
                'players',
                ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
                ['npc-velvet-queen', 'Lady_Vega', 23, 14200, 198000, 140, 50, 2600, 2500, 140, 50, 2600, 2500, $nowIso, 3100, 2900, 3650, 3400, 1120000, 'Zone City', 8, $today],
            );

            $this->lockMetaKey(self::BAZAARS_META_KEY, '{"shops":{},"listings":{}}');
            $bazaars = $this->loadMetaDoc(self::BAZAARS_META_KEY, ['shops' => [], 'listings' => []]);
            if (empty($bazaars['listings'])) {
                $bazaars['shops']['npc-night-broker'] = [
                    'sellerId' => 'npc-night-broker',
                    'sellerName' => 'NadiaQuick',
                    'open' => true,
                    'tagline' => 'Harbor Wholesale Meds & Plushies — 0% Tax',
                    'totalSalesCash' => 84000,
                ];
                $bazaars['listings']['bz-seed-medkit'] = [
                    'id' => 'bz-seed-medkit',
                    'sellerId' => 'npc-night-broker',
                    'sellerName' => 'NadiaQuick',
                    'itemId' => 'medkit',
                    'quantity' => 5,
                    'unitPrice' => 10500,
                    'status' => 'active',
                    'createdAt' => $nowIso,
                ];
                $bazaars['listings']['bz-seed-camel'] = [
                    'id' => 'bz-seed-camel',
                    'sellerId' => 'npc-night-broker',
                    'sellerName' => 'NadiaQuick',
                    'itemId' => 'plush_camel',
                    'quantity' => 4,
                    'unitPrice' => 13500,
                    'status' => 'active',
                    'createdAt' => $nowIso,
                ];
                $this->saveMetaDoc(self::BAZAARS_META_KEY, $bazaars);
            }

            $this->lockMetaKey(self::COMPANIES_META_KEY, '{"companies":{}}');
            $companies = $this->loadMetaDoc(self::COMPANIES_META_KEY, ['companies' => []]);
            if (empty($companies['companies'])) {
                $companies['companies']['cmp-harbor-oil'] = [
                    'id' => 'cmp-harbor-oil',
                    'type' => 'oil_rig',
                    'name' => 'Gulf Sovereign Drilling',
                    'directorId' => 'npc-velvet-queen',
                    'directorName' => 'Lady_Vega',
                    'stars' => 3,
                    'companyXp' => 240,
                    'revenue' => 480000,
                    'adBudget' => 15000,
                    'servicePrice' => 105,
                    'status' => 'active',
                    'employees' => [
                        'npc-velvet-queen' => [
                            'playerId' => 'npc-velvet-queen',
                            'username' => 'Lady_Vega',
                            'role' => 'director',
                            'wage' => 8500,
                            'shifts' => 14,
                            'joinedAt' => $nowIso,
                        ],
                    ],
                    'createdAt' => $nowIso,
                ];
                $companies['companies']['cmp-velvet-sweet'] = [
                    'id' => 'cmp-velvet-sweet',
                    'type' => 'sweet_shop',
                    'name' => 'Corniche Confectionery',
                    'directorId' => 'npc-night-broker',
                    'directorName' => 'NadiaQuick',
                    'stars' => 5,
                    'companyXp' => 610,
                    'revenue' => 310000,
                    'adBudget' => 10000,
                    'servicePrice' => 95,
                    'status' => 'active',
                    'employees' => [
                        'npc-night-broker' => [
                            'playerId' => 'npc-night-broker',
                            'username' => 'NadiaQuick',
                            'role' => 'director',
                            'wage' => 4200,
                            'shifts' => 22,
                            'joinedAt' => $nowIso,
                        ],
                    ],
                    'createdAt' => $nowIso,
                ];
                $this->saveMetaDoc(self::COMPANIES_META_KEY, $companies);
            }

            $this->database->execute(
                "INSERT INTO engine_metadata (name, value) VALUES (:name, '1') ON CONFLICT (name) DO UPDATE SET value = '1'",
                ['name' => self::SEED_META_KEY],
            );
        });
    }

    private function formatTrade(array $trade, string $viewerId): array
    {
        $p1 = (string) $trade['initiatorId'];
        $p2 = (string) $trade['partnerId'];
        return [
            'id' => $trade['id'],
            'status' => $trade['status'],
            'initiatorId' => $p1,
            'initiatorName' => $trade['initiatorName'],
            'partnerId' => $p2,
            'partnerName' => $trade['partnerName'],
            'isInitiator' => $viewerId === $p1,
            'myEscrow' => $trade['escrow'][$viewerId] ?? ['cash' => 0, 'items' => []],
            'theirEscrow' => $trade['escrow'][$viewerId === $p1 ? $p2 : $p1] ?? ['cash' => 0, 'items' => []],
            'escrow' => $trade['escrow'],
            'accepted' => $trade['accepted'],
            'myAccepted' => (bool) ($trade['accepted'][$viewerId] ?? false),
            'theirAccepted' => (bool) ($trade['accepted'][$viewerId === $p1 ? $p2 : $p1] ?? false),
            'createdAt' => $trade['createdAt'],
            'updatedAt' => $trade['updatedAt'],
            'completedAt' => $trade['completedAt'] ?? null,
        ];
    }

    private function formatCompany(array $comp, string $viewerId): array
    {
        $arch = self::COMPANY_ARCHETYPES[$comp['type']] ?? self::COMPANY_ARCHETYPES['oil_rig'];
        $stars = max(1, min(10, (int) ($comp['stars'] ?? 1)));
        $xp = (int) ($comp['companyXp'] ?? 0);
        $nextStar = min(10, $stars + 1);
        $nextThreshold = self::STAR_THRESHOLDS[$nextStar] ?? 2650;

        $specials = [];
        foreach ($arch['specials'] as $sTier => $sDef) {
            $specials[] = [
                ...$sDef,
                'unlocked' => $stars >= (int) $sTier,
            ];
        }

        return [
            'id' => $comp['id'],
            'type' => $comp['type'],
            'typeNameEn' => $arch['nameEn'],
            'typeNameAr' => $arch['nameAr'],
            'name' => $comp['name'],
            'directorId' => $comp['directorId'],
            'directorName' => $comp['directorName'],
            'isDirector' => ($comp['directorId'] ?? '') === $viewerId,
            'isMember' => isset($comp['employees'][$viewerId]),
            'stars' => $stars,
            'companyXp' => $xp,
            'nextStarXp' => $nextThreshold,
            'revenue' => (int) ($comp['revenue'] ?? 0),
            'adBudget' => (int) ($comp['adBudget'] ?? 5000),
            'servicePrice' => (int) ($comp['servicePrice'] ?? 100),
            'employeeCount' => count($comp['employees'] ?? []),
            'maxEmployees' => 12,
            'employees' => array_values($comp['employees'] ?? []),
            'specials' => $specials,
        ];
    }

    private function formatMarriageForPlayer(array $m, string $viewerId): array
    {
        $isA = ($m['spouseAId'] ?? '') === $viewerId;
        return [
            'marriageId' => $m['id'],
            'spouseId' => $isA ? $m['spouseBId'] : $m['spouseAId'],
            'spouseName' => $isA ? $m['spouseBName'] : $m['spouseAName'],
            'sharedPropertyId' => $m['sharedPropertyId'],
            'sharedMaxHappy' => (int) $m['sharedMaxHappy'],
            'marriedAt' => $m['marriedAt'],
        ];
    }

    private function findPlayerCompanyId(string $playerId, array $state, array $companiesDoc): ?string
    {
        $cid = isset($state['companyId']) && is_string($state['companyId']) ? $state['companyId'] : null;
        if ($cid !== null && isset($companiesDoc['companies'][$cid]) && ($companiesDoc['companies'][$cid]['status'] ?? '') === 'active' && isset($companiesDoc['companies'][$cid]['employees'][$playerId])) {
            return $cid;
        }
        foreach ($companiesDoc['companies'] ?? [] as $id => $comp) {
            if (($comp['status'] ?? '') === 'active' && isset($comp['employees'][$playerId])) {
                return (string) $id;
            }
        }
        return null;
    }

    private function findActiveMarriage(string $playerId, array $marriagesDoc): ?array
    {
        foreach ($marriagesDoc['marriages'] ?? [] as $m) {
            if (($m['status'] ?? '') !== 'married') {
                continue;
            }
            if (($m['spouseAId'] ?? '') === $playerId || ($m['spouseBId'] ?? '') === $playerId) {
                return $m;
            }
        }
        return null;
    }

    /** @return array{0: string, 1: string} */
    private function lookupTradeParticipants(string $tradeId): array
    {
        if ($tradeId === '') {
            throw new InvalidArgumentException('Trade ID is required.');
        }
        $doc = $this->loadMetaDoc(self::TRADES_META_KEY, ['trades' => []]);
        $trade = $doc['trades'][$tradeId] ?? null;
        if (!is_array($trade)) {
            throw new RuntimeException("Unknown trade ID: {$tradeId}");
        }
        return [(string) $trade['initiatorId'], (string) $trade['partnerId']];
    }

    private function &requireOpenTradeForParticipant(array &$doc, string $tradeId, string $playerId): array
    {
        if (!isset($doc['trades'][$tradeId]) || !is_array($doc['trades'][$tradeId])) {
            throw new RuntimeException("Unknown trade ID: {$tradeId}");
        }
        $trade = &$doc['trades'][$tradeId];
        if (($trade['initiatorId'] ?? '') !== $playerId && ($trade['partnerId'] ?? '') !== $playerId) {
            throw new RuntimeException('You are not a participant in this trade.');
        }
        if (($trade['status'] ?? '') !== 'open') {
            throw new RuntimeException("Trade is already {$trade['status']}.");
        }
        return $trade;
    }

    private function resolveTargetPlayer(string $query): array
    {
        $byId = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $query]);
        if ($byId !== null) {
            return $byId;
        }
        $byName = $this->database->fetchOne('SELECT * FROM players WHERE LOWER(username) = LOWER(:name)', ['name' => $query]);
        if ($byName !== null) {
            return $byName;
        }
        throw new InvalidArgumentException("Operative '{$query}' was not found in Zone City.");
    }

    private function pushNotification(string $playerId, string $type, array $payload): void
    {
        $this->database->execute(
            'INSERT INTO notifications (id, player_id, type, payload_json, read_at, created_at) VALUES (:id, :player, :type, :payload, NULL, :created_at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'player' => $playerId,
                'type' => $type,
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'created_at' => gmdate('c', $this->now()),
            ],
        );
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
    }

    private function loadMetaDoc(string $name, array $defaults): array
    {
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => $name]);
        if ($row === null || !isset($row['value'])) {
            return $defaults;
        }
        $decoded = json_decode((string) $row['value'], true);
        if (!is_array($decoded)) {
            return $defaults;
        }
        return array_replace($defaults, $decoded);
    }

    private function saveMetaDoc(string $name, array $doc): void
    {
        $encoded = json_encode($doc, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :value) ON CONFLICT (name) DO UPDATE SET value = :updated',
            ['name' => $name, 'value' => $encoded, 'updated' => $encoded],
        );
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

    private function utf8Length(string $text): int
    {
        if (function_exists('mb_strlen')) {
            return mb_strlen($text, 'UTF-8');
        }
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        return is_array($chars) ? count($chars) : strlen($text);
    }

    private function utf8Slice(string $text, int $maxChars): string
    {
        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, $maxChars, 'UTF-8');
        }
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($chars)) {
            return substr($text, 0, $maxChars);
        }
        return implode('', array_slice($chars, 0, $maxChars));
    }
}

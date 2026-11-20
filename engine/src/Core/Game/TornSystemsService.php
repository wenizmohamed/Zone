<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Server-authoritative Torn City core gameplay systems (ZONE v148):
 * Drugs/Overdose/Addiction/Rehab, Medical & Booster cooldown caps, Crimes 2.0
 * 4-tier engine with rotating security/search modifiers, Bank Term CDs,
 * 8-Ticker Stock Exchange + Benefit Blocks, Property Cash Vaults & Island Staff,
 * Points Building, Museum Plushie/Flower Sets, Merits 20-upgrade tree + reset,
 * Raceway, Books, Blood Bags, Lawyer Cards, Casino wagers, and OC 2.0 planning.
 */
final class TornSystemsService
{
    public const MAX_MEDICAL_CD_MS = 21_600_000; // 6h max medical cooldown cap
    public const MAX_BOOSTER_CD_MS = 86_400_000; // 24h max booster cooldown cap

    public const DRUGS = [
        'xanax' => [
            'name' => 'Xanax',
            'energy' => 250,
            'nerve' => 0,
            'happy' => 0,
            'life' => 0,
            'doublesHappy' => false,
            'cdSeconds' => 25200, // 7h
            'odBps' => 250,       // 2.5%
            'addiction' => 3,
        ],
        'ecstasy' => [
            'name' => 'Ecstasy',
            'energy' => 0,
            'nerve' => 0,
            'happy' => 0,
            'life' => 0,
            'doublesHappy' => true,
            'cdSeconds' => 14400, // 4h
            'odBps' => 400,       // 4.0%
            'addiction' => 2,
        ],
        'vicodin' => [
            'name' => 'Vicodin',
            'energy' => 0,
            'nerve' => 0,
            'happy' => 0,
            'life' => 200,
            'doublesHappy' => false,
            'cdSeconds' => 18000, // 5h
            'odBps' => 150,       // 1.5%
            'addiction' => 2,
        ],
        'cannabis' => [
            'name' => 'Cannabis',
            'energy' => 0,
            'nerve' => 8,
            'happy' => 0,
            'life' => 0,
            'doublesHappy' => false,
            'cdSeconds' => 3600,  // 1h
            'odBps' => 50,        // 0.5%
            'addiction' => 1,
        ],
        'lsd' => [
            'name' => 'LSD',
            'energy' => 50,
            'nerve' => 5,
            'happy' => 500,
            'life' => 0,
            'doublesHappy' => false,
            'cdSeconds' => 21600, // 6h
            'odBps' => 300,       // 3.0%
            'addiction' => 2,
        ],
    ];

    public const OVERCAP_BOOSTERS = ['edvd', 'fhc', 'energydrink', 'lollipop'];

    public const BOOSTER_CD_SECONDS = [
        'edvd' => 21600,       // 6h
        'fhc' => 21600,        // 6h
        'energydrink' => 7200, // 2h
        'lollipop' => 1800,    // 30m
        'drink' => 1800,       // 30m
    ];

    public const MEDICAL_CD_SECONDS = [
        'bloodbag' => 3600,    // 1h
        'morphine' => 5400,    // 1.5h
        'epinephrine' => 1800, // 30m
        'medkit' => 900,       // 15m
        'smallkit' => 900,     // 15m
        'pills' => 900,        // 15m
    ];

    public const CRIMES_2 = [
        '1' => ['key' => 'search_cash', 'name' => 'Search for Cash', 'nerve' => 2, 'cash' => 4200, 'xp' => 6, 'enhancerId' => 'glasses', 'enhancer' => 'Glasses (#564)', 'loot' => 'plush_camel', 'diffBps' => 0, 'penalty' => 'jail'],
        '2' => ['key' => 'bootlegging', 'name' => 'Bootlegging', 'nerve' => 3, 'cash' => 6800, 'xp' => 8, 'enhancerId' => 'high_speed_drive', 'enhancer' => 'High-Speed Drive (#565)', 'loot' => 'lollipop', 'diffBps' => 200, 'penalty' => 'jail'],
        '3' => ['key' => 'graffiti', 'name' => 'Graffiti', 'nerve' => 3, 'cash' => 5400, 'xp' => 9, 'enhancerId' => 'paint_mask', 'enhancer' => 'Paint Mask (#550)', 'loot' => 'cannabis', 'diffBps' => 300, 'penalty' => 'jail'],
        '4' => ['key' => 'shoplifting', 'name' => 'Shoplifting', 'nerve' => 4, 'cash' => 8900, 'xp' => 11, 'enhancerId' => 'mountain_bike', 'enhancer' => 'Mountain Bike (#566)', 'loot' => 'energydrink', 'diffBps' => 500, 'penalty' => 'jail'],
        '5' => ['key' => 'pickpocketing', 'name' => 'Pickpocketing', 'nerve' => 5, 'cash' => 12400, 'xp' => 14, 'enhancerId' => 'cut_throat_razor', 'enhancer' => 'Cut-Throat Razor (#567)', 'loot' => 'vicodin', 'diffBps' => 700, 'penalty' => 'hosp'],
        '6' => ['key' => 'card_skimming', 'name' => 'Card Skimming', 'nerve' => 6, 'cash' => 18500, 'xp' => 18, 'enhancerId' => 'duct_tape', 'enhancer' => 'Duct Tape (#571)', 'loot' => 'lsd', 'diffBps' => 900, 'penalty' => 'jail'],
        '7' => ['key' => 'burglary', 'name' => 'Burglary', 'nerve' => 6, 'cash' => 22000, 'xp' => 20, 'enhancerId' => 'flashlight', 'enhancer' => 'Flashlight (#572)', 'loot' => 'bloodbag', 'diffBps' => 1100, 'penalty' => 'hosp'],
        '8' => ['key' => 'hustling', 'name' => 'Hustling', 'nerve' => 4, 'cash' => 14500, 'xp' => 15, 'enhancerId' => 'megaphone', 'enhancer' => 'Megaphone (#573)', 'loot' => 'ecstasy', 'diffBps' => 800, 'penalty' => 'jail'],
        '9' => ['key' => 'disposal', 'name' => 'Disposal', 'nerve' => 6, 'cash' => 26000, 'xp' => 22, 'enhancerId' => 'latex_gloves', 'enhancer' => 'Latex Gloves (#574)', 'loot' => 'morphine', 'diffBps' => 1200, 'penalty' => 'hosp'],
        '10' => ['key' => 'cracking', 'name' => 'Cracking', 'nerve' => 7, 'cash' => 29500, 'xp' => 25, 'enhancerId' => 'office_chair', 'enhancer' => 'Office Chair (#575)', 'loot' => 'flash_grenade', 'diffBps' => 1400, 'penalty' => 'jail'],
        '11' => ['key' => 'forgery', 'name' => 'Forgery', 'nerve' => 5, 'cash' => 24000, 'xp' => 21, 'enhancerId' => 'magnifying_glass', 'enhancer' => 'Magnifying Glass (#576)', 'loot' => 'lawyer_card', 'diffBps' => 1250, 'penalty' => 'jail'],
        '12' => ['key' => 'scamming', 'name' => 'Scamming', 'nerve' => 7, 'cash' => 34000, 'xp' => 28, 'enhancerId' => 'ergonomic_keyboard', 'enhancer' => 'Ergonomic Keyboard (#577)', 'loot' => 'edvd', 'diffBps' => 1550, 'penalty' => 'jail'],
        '13' => ['key' => 'arson', 'name' => 'Arson', 'nerve' => 9, 'cash' => 48000, 'xp' => 36, 'enhancerId' => 'windproof_lighter', 'enhancer' => 'Windproof Lighter (#544)', 'loot' => 'xanax', 'diffBps' => 1800, 'penalty' => 'hosp'],
    ];

    public const STOCKS = [
        'SYM' => ['name' => 'Symbiotic Ltd.', 'basePrice' => 680, 'blockShares' => 500, 'divType' => 'item', 'divId' => 'xanax', 'divQty' => 1, 'divLabel' => '1x Xanax Drug Pack'],
        'FHG' => ['name' => 'Feathery Hotels Group', 'basePrice' => 12400, 'blockShares' => 1000, 'divType' => 'item', 'divId' => 'fhc', 'divQty' => 1, 'divLabel' => '1x Feathery Hotel Coupon'],
        'MCS' => ['name' => 'Mc Smoogle Corp', 'basePrice' => 1650, 'blockShares' => 1000, 'divType' => 'energy', 'divId' => 'energy', 'divQty' => 300, 'divLabel' => '+300 Energy'],
        'LAG' => ['name' => 'Legal Authorities Group', 'basePrice' => 920, 'blockShares' => 750, 'divType' => 'item', 'divId' => 'lawyer_card', 'divQty' => 1, 'divLabel' => '1x Lawyer Business Card'],
        'TCT' => ['name' => 'Torn City Times', 'basePrice' => 310, 'blockShares' => 500, 'divType' => 'cash', 'divId' => 'cash', 'divQty' => 100000, 'divLabel' => '$100,000 Cash'],
        'GRN' => ['name' => 'Grain Holdings', 'basePrice' => 540, 'blockShares' => 1000, 'divType' => 'cash', 'divId' => 'cash', 'divQty' => 250000, 'divLabel' => '$250,000 Cash'],
        'IOU' => ['name' => 'Insured On Us Bank', 'basePrice' => 780, 'blockShares' => 1500, 'divType' => 'cash', 'divId' => 'cash', 'divQty' => 400000, 'divLabel' => '$400,000 Cash'],
        'PRN' => ['name' => 'Ribaldry Entertainment', 'basePrice' => 2950, 'blockShares' => 1000, 'divType' => 'item', 'divId' => 'edvd', 'divQty' => 1, 'divLabel' => '1x Erotic DVD'],
    ];

    public const BANK_CD_TERMS = [
        '1h'  => ['durationMs' => 3_600_000,        'aprBps' => 450,  'yieldBps' => 80],
        '7d'  => ['durationMs' => 604_800_000,      'aprBps' => 846,  'yieldBps' => 350],
        '14d' => ['durationMs' => 1_209_600_000,    'aprBps' => 910,  'yieldBps' => 750],
        '30d' => ['durationMs' => 2_592_000_000,    'aprBps' => 1080, 'yieldBps' => 1650],
        '90d' => ['durationMs' => 7_776_000_000,    'aprBps' => 1350, 'yieldBps' => 5200],
    ];

    public const VAULT_CAPS = [
        'shack' => 0,
        'trailer' => 0,
        'apt' => 1_000_000,
        'semi' => 5_000_000,
        'house' => 25_000_000,
        'villa' => 100_000_000,
        'island' => 1_000_000_000,
    ];

    public const ISLAND_STAFF = [
        'butler'      => ['cost' => 35_000,  'name' => 'Estate Butler',  'perk' => '+250 Max Happiness & Upkeep Care'],
        'doctor'      => ['cost' => 65_000,  'name' => 'Private Doctor', 'perk' => '-15% Medical Cooldowns'],
        'vault_guard' => ['cost' => 95_000,  'name' => 'Vault Guard',    'perk' => 'Unlocks & +25% Property Cash Vault'],
        'pilot'       => ['cost' => 150_000, 'name' => 'Private Pilot',  'perk' => 'Airstrip -30% Flight Time & +10 Luggage'],
    ];

    public const PLUSHIE_SET = ['plush_camel', 'plush_bear', 'plush_moose', 'plush_pharaoh', 'plush_falcon', 'plush_lion'];
    public const FLOWER_SET  = ['flower_orchid', 'flower_lotus', 'flower_cherry', 'flower_peony', 'flower_tribulus', 'flower_violet'];

    public const MERIT_KEYS = [
        // v145 UI canonical 20 keys
        'nerve', 'crit', 'life', 'crime', 'awareness',
        'brawn', 'protection', 'sharpness', 'evasion',
        'bank', 'edu', 'emp', 'looting', 'hosp', 'stealth',
        'gym', 'rifle', 'smg', 'pistol', 'melee',
        // Torn API canonical keys
        'nerve_bar', 'crit_rate', 'life_points', 'crime_xp', 'education_length',
        'bank_interest', 'masterful_looting', 'hospitalizing',
        'heavy_artillery', 'machine_guns', 'rifles', 'sub_machine_guns',
        'shotguns', 'pistols', 'clubs', 'piercing', 'slashing', 'mechanical', 'temporary',
    ];

    public function __construct(
        private readonly Database $database,
        private readonly Ledger $ledger,
        private readonly EventBus $events,
        private readonly ?Closure $random = null,
    ) {}

    private function roll(int $min, int $max): int
    {
        if ($this->random !== null) {
            $val = (int) ($this->random)($min, $max);
            return max($min, min($max, $val));
        }
        return random_int($min, $max);
    }

    public static function parsePositiveInt(string $raw, int $min, int $max, string $label): int
    {
        $clean = trim($raw);
        if (preg_match('/^[1-9][0-9]{0,11}$/D', $clean) !== 1) {
            throw new InvalidArgumentException("Invalid {$label}: positive integer required.");
        }
        $val = (int) $clean;
        if ($val < $min || $val > $max) {
            throw new InvalidArgumentException("{$label} must be between " . number_format($min) . ' and ' . number_format($max) . '.');
        }
        return $val;
    }

    public static function isDrug(string $itemId): bool
    {
        return isset(self::DRUGS[$itemId]);
    }

    public static function ensureCooldowns(array &$state): void
    {
        $cd = is_array($state['cooldowns'] ?? null) ? $state['cooldowns'] : [];
        $state['cooldowns'] = [
            'drugUntil' => max(0, (int) ($cd['drugUntil'] ?? 0)),
            'medicalUntil' => max(0, (int) ($cd['medicalUntil'] ?? 0)),
            'boosterUntil' => max(0, (int) ($cd['boosterUntil'] ?? 0)),
            'overdoseCount' => max(0, (int) ($cd['overdoseCount'] ?? 0)),
            'addiction' => max(0, (int) ($state['addiction'] ?? ($cd['addiction'] ?? 0))),
        ];
        $state['addiction'] = $state['cooldowns']['addiction'];
    }

    public static function enforceAndArmConsumableCooldown(string $itemId, string $itemType, array &$state, int $nowMs): void
    {
        self::ensureCooldowns($state);
        if ($itemType === 'medical') {
            $cdSec = self::MEDICAL_CD_SECONDS[$itemId] ?? 900;
            if (!empty($state['tornState']['staff']['doctor'])) {
                $cdSec = max(60, (int) round($cdSec * 0.85));
            }
            $cdMs = $cdSec * 1000;
            $remMs = max(0, (int) $state['cooldowns']['medicalUntil'] - $nowMs);
            if ($remMs >= self::MAX_MEDICAL_CD_MS || $remMs + $cdMs > self::MAX_MEDICAL_CD_MS) {
                throw new RuntimeException('Medical cooldown cap (6h) reached. Wait for medical toxicity to subside.');
            }
            $state['cooldowns']['medicalUntil'] = max($nowMs, (int) $state['cooldowns']['medicalUntil']) + $cdMs;
            return;
        }
        $cdSec = self::BOOSTER_CD_SECONDS[$itemId] ?? 1800;
        $cdMs = $cdSec * 1000;
        $remMs = max(0, (int) $state['cooldowns']['boosterUntil'] - $nowMs);
        if ($remMs >= self::MAX_BOOSTER_CD_MS || $remMs + $cdMs > self::MAX_BOOSTER_CD_MS) {
            throw new RuntimeException('Booster cooldown cap (24h) reached. Wait before consuming another booster.');
        }
        $state['cooldowns']['boosterUntil'] = max($nowMs, (int) $state['cooldowns']['boosterUntil']) + $cdMs;
    }

    public function useDrug(string $playerId, string $drugId, array $player, array &$state, int $nowMs, string $correlationId): array
    {
        $cfg = self::DRUGS[$drugId] ?? throw new InvalidArgumentException('Unknown drug compound.');
        if ((int) ($state['inv'][$drugId] ?? 0) < 1) {
            throw new RuntimeException('You do not own this item.');
        }
        self::ensureCooldowns($state);
        if ((int) $state['cooldowns']['drugUntil'] > $nowMs) {
            $sec = (int) ceil(((int) $state['cooldowns']['drugUntil'] - $nowMs) / 1000);
            throw new RuntimeException("Drug cooldown active ({$sec}s remaining). Cannot take another drug yet.");
        }

        $state['inv'][$drugId] = (int) $state['inv'][$drugId] - 1;
        $this->ledger->record($playerId, 'item:' . $drugId, -1, (int) $state['inv'][$drugId], 'drug.use', $correlationId);
        $state['cooldowns']['drugUntil'] = $nowMs + $cfg['cdSeconds'] * 1000;

        $odBps = !empty($state['eduDone']['chem']) ? (int) round($cfg['odBps'] * 0.75) : $cfg['odBps'];
        if ($this->roll(1, 10000) <= $odBps) {
            $hospMult = !empty($state['fac']['ups']['hospTime']) ? 0.8 : 1.0;
            $hospMs = (int) round(1_800_000 * $hospMult);
            $state['hospUntil'] = max((int) ($state['hospUntil'] ?? 0), $nowMs + $hospMs);
            $newHappy = max(100, intdiv((int) $player['happy'], 4));
            $this->database->execute(
                'UPDATE players SET energy = 0, happy = :happy WHERE id = :id',
                ['happy' => $newHappy, 'id' => $playerId],
            );
            $state['cooldowns']['overdoseCount']++;
            $addiction = min(100, (int) $state['addiction'] + 5);
            $state['addiction'] = $addiction;
            $state['cooldowns']['addiction'] = $addiction;
            return [
                'type' => 'drug.use',
                'drugId' => $drugId,
                'overdosed' => true,
                'hospitalSeconds' => (int) ceil($hospMs / 1000),
                'addiction' => $addiction,
                'restored' => [
                    'energy' => -(int) $player['energy'],
                    'nerve' => 0,
                    'life' => 0,
                    'happy' => $newHappy - (int) $player['happy'],
                ],
            ];
        }

        $newEnergy = $cfg['energy'] > 0 ? min(1000, (int) $player['energy'] + $cfg['energy']) : (int) $player['energy'];
        $newNerve = $cfg['nerve'] > 0 ? min((int) $player['max_nerve'] + 50, (int) $player['nerve'] + $cfg['nerve']) : (int) $player['nerve'];
        $newLife = $cfg['life'] > 0 ? min((int) $player['max_life'] + 200, (int) $player['life'] + $cfg['life']) : (int) $player['life'];
        $newHappy = $cfg['doublesHappy']
            ? min(99999, max((int) $player['happy'] * 2, (int) $player['happy'] + 500))
            : ($cfg['happy'] > 0 ? min(99999, (int) $player['happy'] + $cfg['happy']) : (int) $player['happy']);

        $this->database->execute(
            'UPDATE players SET energy = :e, nerve = :n, life = :l, happy = :h WHERE id = :id',
            ['e' => $newEnergy, 'n' => $newNerve, 'l' => $newLife, 'h' => $newHappy, 'id' => $playerId],
        );
        $addiction = min(100, (int) $state['addiction'] + $cfg['addiction']);
        $state['addiction'] = $addiction;
        $state['cooldowns']['addiction'] = $addiction;

        return [
            'type' => 'drug.use',
            'drugId' => $drugId,
            'overdosed' => false,
            'addiction' => $addiction,
            'restored' => [
                'energy' => $newEnergy - (int) $player['energy'],
                'nerve' => $newNerve - (int) $player['nerve'],
                'life' => $newLife - (int) $player['life'],
                'happy' => $newHappy - (int) $player['happy'],
            ],
        ];
    }

    public function happyJump(string $playerId, array $player, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        self::ensureCooldowns($state);
        if ((int) $state['cooldowns']['drugUntil'] > $nowMs) {
            $sec = (int) ceil(((int) $state['cooldowns']['drugUntil'] - $nowMs) / 1000);
            throw new RuntimeException("Drug cooldown active ({$sec}s remaining). Cannot execute Happy Jump.");
        }
        $boosterRemMs = max(0, (int) $state['cooldowns']['boosterUntil'] - $nowMs);
        if ($boosterRemMs + 21_600_000 > self::MAX_BOOSTER_CD_MS) {
            throw new RuntimeException('Booster cooldown cap (24h) reached. Cannot stack Happy Jump.');
        }

        $ownsStack = (int) ($state['inv']['xanax'] ?? 0) >= 1
            && (int) ($state['inv']['edvd'] ?? 0) >= 1
            && (int) ($state['inv']['ecstasy'] ?? 0) >= 1;

        $cashDelta = 0;
        if ($ownsStack) {
            foreach (['xanax', 'edvd', 'ecstasy'] as $stackItem) {
                $state['inv'][$stackItem] = (int) $state['inv'][$stackItem] - 1;
                $this->ledger->record($playerId, 'item:' . $stackItem, -1, (int) $state['inv'][$stackItem], 'torn.happyJump', $correlationId);
            }
            $source = 'owned_stack';
        } else {
            $packCost = 120_000;
            $cashFn(-$packCost, 'torn.happyJump', $correlationId);
            $cashDelta = -$packCost;
            $source = 'budget_pack';
        }

        $state['cooldowns']['drugUntil'] = $nowMs + 25_200_000; // 7h
        $state['cooldowns']['boosterUntil'] = max($nowMs, (int) $state['cooldowns']['boosterUntil']) + 21_600_000; // 6h

        $odBps = !empty($state['eduDone']['chem']) ? 260 : 350; // 3.5% base OD risk
        if ($this->roll(1, 10000) <= $odBps) {
            $hospMult = !empty($state['fac']['ups']['hospTime']) ? 0.8 : 1.0;
            $hospMs = (int) round(1_800_000 * $hospMult);
            $state['hospUntil'] = max((int) ($state['hospUntil'] ?? 0), $nowMs + $hospMs);
            $newHappy = max(100, intdiv((int) $player['happy'], 4));
            $this->database->execute(
                'UPDATE players SET energy = 0, happy = :happy WHERE id = :id',
                ['happy' => $newHappy, 'id' => $playerId],
            );
            $state['cooldowns']['overdoseCount']++;
            $addiction = min(100, (int) $state['addiction'] + 5);
            $state['addiction'] = $addiction;
            $state['cooldowns']['addiction'] = $addiction;
            return [
                'type' => 'torn.happyJump',
                'source' => $source,
                'overdosed' => true,
                'cashDelta' => $cashDelta,
                'hospitalSeconds' => (int) ceil($hospMs / 1000),
                'addiction' => $addiction,
                'restored' => [
                    'happy' => $newHappy - (int) $player['happy'],
                    'energy' => -(int) $player['energy'],
                ],
            ];
        }

        $newHappy = min(99999, ((int) $player['happy'] + 2500) * 2);
        $newEnergy = min(1000, (int) $player['energy'] + 250);
        $this->database->execute(
            'UPDATE players SET happy = :happy, energy = :energy WHERE id = :id',
            ['happy' => $newHappy, 'energy' => $newEnergy, 'id' => $playerId],
        );
        $addiction = min(100, (int) $state['addiction'] + 2);
        $state['addiction'] = $addiction;
        $state['cooldowns']['addiction'] = $addiction;

        return [
            'type' => 'torn.happyJump',
            'source' => $source,
            'overdosed' => false,
            'cashDelta' => $cashDelta,
            'addiction' => $addiction,
            'restored' => [
                'happy' => $newHappy - (int) $player['happy'],
                'energy' => $newEnergy - (int) $player['energy'],
            ],
        ];
    }

    public function rehab(string $playerId, array $player, array &$state, Closure $cashFn, string $correlationId): array
    {
        self::ensureCooldowns($state);
        $addiction = (int) $state['addiction'];
        $odCount = (int) $state['cooldowns']['overdoseCount'];
        if ($addiction <= 0 && $odCount <= 0) {
            throw new RuntimeException('You have no drug addiction or overdose trauma requiring rehab.');
        }
        $cost = max(10_000, $addiction * 15_000);
        $cashFn(-$cost, 'torn.rehab', $correlationId);

        $state['addiction'] = 0;
        $state['cooldowns']['addiction'] = 0;
        $state['cooldowns']['overdoseCount'] = 0;
        $newHappy = min(99999, (int) $player['happy'] + 250);
        $this->database->execute('UPDATE players SET happy = :happy WHERE id = :id', ['happy' => $newHappy, 'id' => $playerId]);

        return [
            'cashDelta' => -$cost,
            'addictionCleared' => $addiction,
            'happyRestored' => $newHappy - (int) $player['happy'],
        ];
    }

    public static function shopliftingSecurity(int $unixSeconds): array
    {
        $window = intdiv(max(1, $unixSeconds), 900);
        $shops = [
            ['id' => 'sallys', 'shop' => "Sally's Sweet Shop"],
            ['id' => 'bits', 'shop' => "Bits 'n' Bobs"],
            ['id' => 'clothing', 'shop' => 'Zone Clothing'],
            ['id' => 'super', 'shop' => 'Super Store'],
            ['id' => 'cyber', 'shop' => 'Cyber Force'],
            ['id' => 'bigals', 'shop' => "Big Al's Gun Shop"],
        ];
        $out = [];
        foreach ($shops as $idx => $s) {
            $h1 = abs(crc32("shop-cam:{$idx}:{$window}"));
            $h2 = abs(crc32("shop-grd:{$idx}:{$window}"));
            $out[] = [
                'id' => $s['id'],
                'shop' => $s['shop'],
                'cameraDisabled' => ($h1 % 100) < 42,
                'guardOffDuty' => ($h2 % 100) < 38,
                'windowEpoch' => $window * 900,
            ];
        }
        return $out;
    }

    public static function searchForCashModifiers(int $unixSeconds): array
    {
        $window = intdiv(max(1, $unixSeconds), 900);
        $locs = [
            ['id' => 'trash', 'subcrime' => 'Search the Trash', 'titles' => ['Garbage cans are overflowing', 'Bins freshly emptied', 'Steady alley discards']],
            ['id' => 'subway', 'subcrime' => 'Search the Subway', 'titles' => ['Rush-hour commuter crush', 'Normal foot traffic', 'Late-night empty platform']],
            ['id' => 'junkyard', 'subcrime' => 'Search the Junkyard', 'titles' => ['Fresh scrap deliveries', 'Guard dog patrolling', 'Quiet salvage piles']],
            ['id' => 'beach', 'subcrime' => 'Search the Beach', 'titles' => ['Weekend tourist crowd', 'High tide incoming', 'Low tide sandbars exposed']],
            ['id' => 'cemetery', 'subcrime' => 'Search the Cemetery', 'titles' => ['Recent funeral procession', 'Groundskeeper on rounds', 'Quiet misty dusk']],
            ['id' => 'fountain', 'subcrime' => 'Search the Fountain', 'titles' => ['Weekend tourist coins', 'Plaza patrol nearby', 'Freshly tossed wishes']],
        ];
        $out = [];
        foreach ($locs as $idx => $loc) {
            $h = abs(crc32("sfc:{$idx}:{$window}"));
            $pct = 35 + ($h % 56); // 35% .. 90%
            $titleIdx = $pct >= 72 ? 0 : ($pct <= 48 ? 1 : 2);
            $out[] = [
                'id' => $loc['id'],
                'subcrime' => $loc['subcrime'],
                'title' => $loc['titles'][$titleIdx],
                'percentage' => $pct,
                'windowEpoch' => $window * 900,
            ];
        }
        return $out;
    }

    public function executeCrime2(
        string $playerId,
        string $action,
        string $id,
        array $player,
        array &$state,
        int $nowMs,
        Closure $cashFn,
        string $correlationId,
    ): array {
        $unixSec = intdiv($nowMs, 1000);
        $extraSuccessBps = 0;
        $legacySkillAlias = null;

        if ($action === 'torn.shoplift') {
            $crimeId = '4';
            $legacySkillAlias = 'shoplift';
            $shopMap = [
                'sallys' => ['nerve' => 4, 'cash' => 5800, 'xp' => 8, 'diffBps' => 200],
                'bits' => ['nerve' => 4, 'cash' => 6400, 'xp' => 9, 'diffBps' => 250],
                'super' => ['nerve' => 4, 'cash' => 8900, 'xp' => 11, 'diffBps' => 450],
                'superstore' => ['nerve' => 4, 'cash' => 8900, 'xp' => 11, 'diffBps' => 450],
                'clothing' => ['nerve' => 5, 'cash' => 11200, 'xp' => 13, 'diffBps' => 650],
                'cyber' => ['nerve' => 5, 'cash' => 14500, 'xp' => 15, 'diffBps' => 850],
                'bigals' => ['nerve' => 6, 'cash' => 24000, 'xp' => 22, 'diffBps' => 1200],
            ];
            $sub = $shopMap[$id] ?? $shopMap['sallys'];
            $cfg = [...self::CRIMES_2['4'], 'nerve' => $sub['nerve'], 'cash' => $sub['cash'], 'xp' => $sub['xp'], 'diffBps' => $sub['diffBps']];
            foreach (self::shopliftingSecurity($unixSec) as $secRow) {
                if ($secRow['id'] === ($id === 'superstore' ? 'super' : $id)) {
                    if ($secRow['cameraDisabled']) $extraSuccessBps += 800;
                    if ($secRow['guardOffDuty']) $extraSuccessBps += 800;
                    break;
                }
            }
        } elseif ($action === 'torn.searchCash') {
            $crimeId = '1';
            $legacySkillAlias = 'search';
            $locCash = ['fountain' => 4200, 'trash' => 4600, 'beach' => 5000, 'junkyard' => 5600, 'cemetery' => 6800, 'subway' => 8200];
            $base = $locCash[$id] ?? 4200;
            $modPct = 65;
            foreach (self::searchForCashModifiers($unixSec) as $mRow) {
                if ($mRow['id'] === $id) {
                    $modPct = (int) $mRow['percentage'];
                    break;
                }
            }
            $extraSuccessBps += ($modPct - 55) * 25;
            $cfg = [...self::CRIMES_2['1'], 'cash' => max(1500, (int) round($base * ($modPct / 65.0)))];
        } elseif ($action === 'torn.skimmer' || $action === 'torn.skimmerCollect') {
            $crimeId = '6';
            $cfg = self::CRIMES_2['6']; // 6 Nerve enforced!
        } elseif ($action === 'torn.cracking') {
            $crimeId = '10';
            $cfg = self::CRIMES_2['10']; // 7 Nerve enforced!
        } else {
            // torn.crime2Execute by numeric ID '1'..'13' or key name
            $crimeId = isset(self::CRIMES_2[$id]) ? $id : null;
            if ($crimeId === null) {
                foreach (self::CRIMES_2 as $cid => $entry) {
                    if ($entry['key'] === $id) {
                        $crimeId = (string) $cid;
                        break;
                    }
                }
            }
            if ($crimeId === null) {
                throw new InvalidArgumentException('Unknown Crimes 2.0 archetype.');
            }
            $cfg = self::CRIMES_2[$crimeId];
        }

        $nerveCost = (int) $cfg['nerve'];
        if ((int) $player['nerve'] < $nerveCost) {
            throw new RuntimeException("Not enough nerve (need {$nerveCost} Nerve).");
        }
        $this->database->execute(
            'UPDATE players SET nerve = nerve - :n WHERE id = :id',
            ['n' => $nerveCost, 'id' => $playerId],
        );

        $skillKey = 'crime2_' . $cfg['key'];
        $state['skill'] = is_array($state['skill'] ?? null) ? $state['skill'] : [];
        $skill = max(0, min(100, (int) ($state['skill'][$skillKey] ?? 0)));

        $enhancerId = $cfg['enhancerId'];
        $hasEnhancer = (int) ($state['inv'][$enhancerId] ?? 0) > 0;
        $meritCrimeRank = max((int) ($state['meritTree']['crime'] ?? 0), (int) ($state['meritTree']['crime_xp'] ?? 0));
        $csBonusBps = (!empty($state['eduDone']['cs']) && in_array($cfg['key'], ['card_skimming', 'cracking'], true)) ? 1000 : 0;
        $crimBonusBps = !empty($state['eduDone']['crim']) ? 800 : 0;

        // Enhancer grants +12% (+1200 bps) success & unique boost
        $enhancerBps = $hasEnhancer ? 1200 : 0;
        $successCap = max(2500, min(9500, 6200 + $skill * 28 + $enhancerBps + $meritCrimeRank * 300 + $csBonusBps + $extraSuccessBps - (int) $cfg['diffBps']));
        $uniqueCap = max(400, min(3200, 700 + $skill * 12 + ($hasEnhancer ? 1200 : 0) + $crimBonusBps));
        $uniqueCap = min($uniqueCap, $successCap - 500);
        $critChanceBps = max(300, 1200 - $skill * 8 - ($hasEnhancer ? 300 : 0));
        $failCap = min(9700, max($successCap, 10000 - $critChanceBps));

        $roll = $this->roll(1, 10000);
        $cashDelta = 0;
        $xpEarned = 0;
        $lootGranted = null;
        $penaltyApplied = null;

        if ($roll <= $uniqueCap) {
            $tier = 'UNIQUE_OUTCOME';
            $cashDelta = max(500, (int) round($cfg['cash'] * 2.2 * (1.0 + $skill * 0.004)));
            $xpEarned = (int) $cfg['xp'] * 2;
            $newSkill = min(100, $skill + 3);
            $lootGranted = $cfg['loot'];
            $state['inv'][$lootGranted] = (int) ($state['inv'][$lootGranted] ?? 0) + 1;
            $this->ledger->record($playerId, 'item:' . $lootGranted, 1, (int) $state['inv'][$lootGranted], 'crime2.unique_loot', $correlationId);
            $cashFn($cashDelta, $action . ':' . $cfg['key'], $correlationId);
            $state['ctr']['crimes'] = (int) ($state['ctr']['crimes'] ?? 0) + 1;
        } elseif ($roll <= $successCap) {
            $tier = 'SUCCESS';
            $cashDelta = max(250, (int) round($cfg['cash'] * (0.9 + $skill * 0.004)));
            $xpEarned = (int) $cfg['xp'];
            $newSkill = min(100, $skill + 2);
            $cashFn($cashDelta, $action . ':' . $cfg['key'], $correlationId);
            $state['ctr']['crimes'] = (int) ($state['ctr']['crimes'] ?? 0) + 1;
        } elseif ($roll <= $failCap) {
            $tier = 'FAIL';
            $xpEarned = 1;
            $newSkill = $skill;
        } else {
            $tier = 'CRITICAL_FAIL';
            $xpEarned = 0;
            $newSkill = max(0, $skill - 1);
            $penType = $cfg['penalty'] === 'hosp' ? 'hosp' : 'jail';
            $mult = $penType === 'jail'
                ? (!empty($state['eduDone']['law']) ? 0.85 : 1.0)
                : (!empty($state['fac']['ups']['hospTime']) ? 0.8 : 1.0);
            $penMs = (int) round(300_000 * $mult); // 5m base penalty
            $state[$penType . 'Until'] = max((int) ($state[$penType . 'Until'] ?? 0), $nowMs + $penMs);
            $penaltyApplied = ['type' => $penType, 'seconds' => (int) ceil($penMs / 1000)];
        }

        $state['skill'][$skillKey] = $newSkill;
        if ($legacySkillAlias !== null) {
            $state['skill'][$legacySkillAlias] = $newSkill;
        }
        $state['crimeXp'] = (int) ($state['crimeXp'] ?? 96) + $xpEarned;
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $state['tornState']['lastCrime2'] = [
            'id' => $crimeId,
            'key' => $cfg['key'],
            'name' => $cfg['name'],
            'tier' => $tier,
            'nerveSpent' => $nerveCost,
            'cashAwarded' => $cashDelta,
            'skill' => $newSkill,
            'enhancer' => $cfg['enhancer'],
            'enhancerActive' => $hasEnhancer,
            'lootItem' => $lootGranted,
            'penalty' => $penaltyApplied,
        ];

        return [
            'cashDelta' => $cashDelta,
            'nerveSpent' => $nerveCost,
            'xpEarned' => $xpEarned,
            'crimeTier' => $tier,
            'crimeKey' => $cfg['key'],
            'skill' => $newSkill,
            'enhancerActive' => $hasEnhancer,
            'lootItem' => $lootGranted,
            'penalty' => $penaltyApplied,
        ];
    }

    public function openBankCd(string $playerId, string $id, array $player, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $existing = $state['activeCd'] ?? ($state['tornState']['activeCd'] ?? null);
        if (is_array($existing) && !empty($existing['principal'])) {
            throw new RuntimeException('An active Bank Term CD is already locked. Claim it upon maturity before opening another.');
        }

        $aliases = [
            '1 Hour CD' => '1h',
            '7 Days CD' => '7d',
            '14 Days CD' => '14d',
            '30 Days CD' => '30d',
            '90 Days CD' => '90d',
        ];
        $parts = explode(':', $id, 2);
        $rawTerm = trim($parts[0]);
        $term = $aliases[$rawTerm] ?? $rawTerm;
        $termCfg = self::BANK_CD_TERMS[$term] ?? throw new InvalidArgumentException('Unsupported Bank CD term. Choose 1h, 7d, 14d, 30d, or 90d.');

        if (isset($parts[1]) && trim($parts[1]) !== '') {
            $principal = self::parsePositiveInt($parts[1], 5_000, 2_000_000_000, 'Bank CD principal');
        } else {
            $defaultPrincipal = min((int) $player['cash'], 50_000);
            if ($defaultPrincipal < 5_000) {
                throw new RuntimeException('Minimum Bank CD investment is $5,000 cash.');
            }
            $principal = $defaultPrincipal;
        }

        // Deduct real principal from player wallet
        $cashFn(-$principal, 'torn.bankCd:' . $term, $correlationId);

        $meritBankRank = max((int) ($state['meritTree']['bank_interest'] ?? 0), (int) ($state['meritTree']['bank'] ?? 0));
        $econMult = !empty($state['eduDone']['econ']) ? 1.05 : 1.0;
        $meritMult = 1.0 + 0.05 * $meritBankRank;
        $effectiveAprBps = (int) round($termCfg['aprBps'] * $meritMult * $econMult);
        $interest = max(1, (int) round($principal * ($termCfg['yieldBps'] / 10000.0) * $meritMult * $econMult));
        $payout = $principal + $interest;

        $cd = [
            'term' => $term,
            'principal' => $principal,
            'interest' => $interest,
            'aprBps' => $effectiveAprBps,
            'payout' => $payout,
            'lockedAt' => $nowMs,
            'maturesAt' => $nowMs + $termCfg['durationMs'],
        ];
        $state['activeCd'] = $cd;
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $state['tornState']['activeCd'] = $cd;

        return [
            'cashDelta' => -$principal,
            'bankDelta' => 0,
            'activeCd' => $cd,
        ];
    }

    public function claimBankCd(string $playerId, array $player, array &$state, int $nowMs, string $correlationId): array
    {
        $cd = $state['activeCd'] ?? ($state['tornState']['activeCd'] ?? null);
        if (!is_array($cd) || empty($cd['payout'])) {
            throw new RuntimeException('No active Bank Term CD to claim.');
        }
        $maturesAt = (int) ($cd['maturesAt'] ?? PHP_INT_MAX);
        if ($nowMs < $maturesAt) {
            $remSec = (int) ceil(($maturesAt - $nowMs) / 1000);
            throw new RuntimeException("Bank CD has not matured yet ({$remSec}s remaining).");
        }

        $payout = (int) $cd['payout'];
        $state['activeCd'] = null;
        if (isset($state['tornState']['activeCd'])) {
            unset($state['tornState']['activeCd']);
        }

        $newBank = (int) $player['bank_balance'] + $payout;
        $this->database->execute(
            'UPDATE players SET bank_balance = :bank WHERE id = :id',
            ['bank' => $newBank, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'bank', $payout, $newBank, 'bank.claimCd', $correlationId);

        return [
            'cashDelta' => 0,
            'bankDelta' => $payout,
            'claimedCd' => $cd,
        ];
    }

    public static function stockQuote(string $ticker, int $unixSeconds): array
    {
        $cfg = self::STOCKS[$ticker] ?? throw new InvalidArgumentException('Unknown stock ticker.');
        $bucket = intdiv(max(1, $unixSeconds), 300);
        $seed = (abs(crc32($ticker)) % 100) * 0.0628318;
        $phase = ($bucket * 0.47) + $seed;
        $prevPhase = (($bucket - 1) * 0.47) + $seed;
        $wave = sin($phase) * 0.095 + cos($phase * 1.7) * 0.025;
        $prevWave = sin($prevPhase) * 0.095 + cos($prevPhase * 1.7) * 0.025;

        $price = max(1, (int) round($cfg['basePrice'] * (1.0 + $wave)));
        $prevPrice = max(1, (int) round($cfg['basePrice'] * (1.0 + $prevWave)));
        $changePct = round((($price - $prevPrice) / $prevPrice) * 100, 2);

        return [
            'ticker' => $ticker,
            'name' => $cfg['name'],
            'price' => $price,
            'basePrice' => $cfg['basePrice'],
            'changePct' => $changePct,
            'blockShares' => $cfg['blockShares'],
            'dividendType' => $cfg['divType'],
            'dividendId' => $cfg['divId'],
            'dividendQty' => $cfg['divQty'],
            'dividendLabel' => $cfg['divLabel'],
        ];
    }

    public function buyStock(string $id, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $parts = explode(':', $id, 2);
        $ticker = strtoupper(trim($parts[0] ?? ''));
        if (!isset(self::STOCKS[$ticker]) || !isset($parts[1])) {
            throw new InvalidArgumentException('Stock buy format must be TICKER:SHARES (e.g. SYM:100).');
        }
        $quote = self::stockQuote($ticker, intdiv($nowMs, 1000));
        $maxSafeByPrice = max(1, intdiv(min(2_000_000_000, intdiv(PHP_INT_MAX, 2)), max(1, $quote['price'])));
        $shares = self::parsePositiveInt($parts[1], 1, min(10_000_000, $maxSafeByPrice), 'share quantity');
        $cost = $shares * $quote['price'];

        $cashFn(-$cost, 'stock.buy:' . $ticker, $correlationId);

        $state['stocks'] = is_array($state['stocks'] ?? null) ? $state['stocks'] : [];
        $holding = is_array($state['stocks'][$ticker] ?? null)
            ? $state['stocks'][$ticker]
            : ['shares' => 0, 'avgCost' => 0.0, 'blockReadyAt' => 0];

        $oldShares = max(0, (int) ($holding['shares'] ?? 0));
        $oldAvg = (float) ($holding['avgCost'] ?? 0.0);
        $newShares = $oldShares + $shares;
        $newAvg = round((($oldShares * $oldAvg) + $cost) / $newShares, 2);
        $blockShares = (int) self::STOCKS[$ticker]['blockShares'];
        $blockReadyAt = max(0, (int) ($holding['blockReadyAt'] ?? 0));
        if ($oldShares < $blockShares && $newShares >= $blockShares) {
            $blockReadyAt = $nowMs + 7 * 86_400_000;
        }

        $state['stocks'][$ticker] = [
            'shares' => $newShares,
            'avgCost' => $newAvg,
            'blockReadyAt' => $blockReadyAt,
        ];

        return [
            'cashDelta' => -$cost,
            'ticker' => $ticker,
            'sharesBought' => $shares,
            'pricePerShare' => $quote['price'],
            'ownedShares' => $newShares,
            'blockReadyAt' => $blockReadyAt,
        ];
    }

    public function sellStock(string $id, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $parts = explode(':', $id, 2);
        $ticker = strtoupper(trim($parts[0] ?? ''));
        if (!isset(self::STOCKS[$ticker]) || !isset($parts[1])) {
            throw new InvalidArgumentException('Stock sell format must be TICKER:SHARES (e.g. SYM:100).');
        }
        $shares = self::parsePositiveInt($parts[1], 1, 10_000_000, 'share quantity');
        $holding = is_array($state['stocks'][$ticker] ?? null) ? $state['stocks'][$ticker] : null;
        $owned = max(0, (int) ($holding['shares'] ?? 0));
        if ($owned < $shares) {
            throw new RuntimeException("You do not own {$shares} shares of {$ticker} to sell.");
        }

        $quote = self::stockQuote($ticker, intdiv($nowMs, 1000));
        $gross = $shares * $quote['price'];
        $fee = max(1, (int) round($gross * 0.01)); // 1% brokerage fee
        $proceeds = max(0, $gross - $fee);

        $remaining = $owned - $shares;
        $blockShares = (int) self::STOCKS[$ticker]['blockShares'];
        // Reset blockReadyAt to 0 if holdings fall below blockShares so re-buying restarts a full 7-day maturity window
        $blockReadyAt = $remaining < $blockShares ? 0 : max(0, (int) ($holding['blockReadyAt'] ?? 0));

        $state['stocks'][$ticker] = [
            'shares' => $remaining,
            'avgCost' => $remaining > 0 ? (float) ($holding['avgCost'] ?? $quote['price']) : 0.0,
            'blockReadyAt' => $blockReadyAt,
        ];

        $cashFn($proceeds, 'stock.sell:' . $ticker, $correlationId);

        return [
            'cashDelta' => $proceeds,
            'ticker' => $ticker,
            'sharesSold' => $shares,
            'pricePerShare' => $quote['price'],
            'fee' => $fee,
            'ownedShares' => $remaining,
            'blockReadyAt' => $blockReadyAt,
        ];
    }

    public function claimStockDividend(string $playerId, string $id, array $player, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $ticker = strtoupper(trim($id));
        $cfg = self::STOCKS[$ticker] ?? throw new InvalidArgumentException('Unknown stock ticker.');
        $holding = is_array($state['stocks'][$ticker] ?? null) ? $state['stocks'][$ticker] : ['shares' => 0, 'avgCost' => 0.0, 'blockReadyAt' => 0];
        $owned = max(0, (int) ($holding['shares'] ?? 0));

        if ($owned < $cfg['blockShares']) {
            throw new RuntimeException("Own at least {$cfg['blockShares']} shares of {$ticker} to collect its Benefit Block.");
        }
        $readyAt = max(0, (int) ($holding['blockReadyAt'] ?? 0));
        if ($readyAt <= 0 || $nowMs < $readyAt) {
            $remSec = $readyAt > $nowMs ? (int) ceil(($readyAt - $nowMs) / 1000) : 604800;
            throw new RuntimeException("{$ticker} Benefit Block dividend is maturing ({$remSec}s remaining).");
        }

        $nextReadyAt = $nowMs + 7 * 86_400_000; // 7-day cycle
        $state['stocks'][$ticker]['blockReadyAt'] = $nextReadyAt;

        $cashDelta = 0;
        if ($cfg['divType'] === 'cash') {
            $cashDelta = (int) $cfg['divQty'];
            $cashFn($cashDelta, 'torn.stockDividend:' . $ticker, $correlationId);
        } elseif ($cfg['divType'] === 'energy') {
            $newEnergy = min(1000, (int) $player['energy'] + (int) $cfg['divQty']);
            $this->database->execute('UPDATE players SET energy = :e WHERE id = :id', ['e' => $newEnergy, 'id' => $playerId]);
        } elseif ($cfg['divType'] === 'item') {
            $itemId = (string) $cfg['divId'];
            $qty = (int) $cfg['divQty'];
            $state['inv'][$itemId] = (int) ($state['inv'][$itemId] ?? 0) + $qty;
            $this->ledger->record($playerId, 'item:' . $itemId, $qty, (int) $state['inv'][$itemId], 'torn.stockDividend:' . $ticker, $correlationId);
        }

        return [
            'cashDelta' => $cashDelta,
            'ticker' => $ticker,
            'dividendLabel' => $cfg['divLabel'],
            'nextReadyAt' => $nextReadyAt,
        ];
    }

    public static function vaultCap(array $state): int
    {
        $prop = (string) ($state['prop'] ?? 'shack');
        $base = self::VAULT_CAPS[$prop] ?? 0;
        $hasGuard = !empty($state['tornState']['staff']['vault_guard']);
        if (!$hasGuard) {
            return $base;
        }
        return $base === 0 ? 500_000 : (int) round($base * 1.25);
    }

    public function vaultDeposit(string $playerId, string $id, array &$state, Closure $cashFn, string $correlationId): array
    {
        $cap = self::vaultCap($state);
        if ($cap <= 0) {
            throw new RuntimeException('Your active property has no Cash Vault. Move into an Apartment+ or hire a Vault Guard.');
        }
        $amount = self::parsePositiveInt($id, 1, 1_000_000_000, 'Vault deposit');
        $cur = max(0, (int) ($state['vaultBalance'] ?? 0));
        if ($cur + $amount > $cap) {
            throw new RuntimeException('Property Vault capacity ($' . number_format($cap) . ') exceeded.');
        }

        $cashFn(-$amount, 'property.vaultDeposit', $correlationId);
        $state['vaultBalance'] = $cur + $amount;
        $this->ledger->record($playerId, 'vault', $amount, $state['vaultBalance'], 'property.vaultDeposit', $correlationId);

        return [
            'cashDelta' => -$amount,
            'vaultBalance' => $state['vaultBalance'],
            'vaultCap' => $cap,
        ];
    }

    public function vaultWithdraw(string $playerId, string $id, array &$state, Closure $cashFn, string $correlationId): array
    {
        $amount = self::parsePositiveInt($id, 1, 1_000_000_000, 'Vault withdrawal');
        $cur = max(0, (int) ($state['vaultBalance'] ?? 0));
        if ($cur < $amount) {
            throw new RuntimeException('Not enough cash stored in your Property Vault.');
        }

        $state['vaultBalance'] = $cur - $amount;
        $this->ledger->record($playerId, 'vault', -$amount, $state['vaultBalance'], 'property.vaultWithdraw', $correlationId);
        $cashFn($amount, 'property.vaultWithdraw', $correlationId);

        return [
            'cashDelta' => $amount,
            'vaultBalance' => $state['vaultBalance'],
            'vaultCap' => self::vaultCap($state),
        ];
    }

    public function hireIslandStaff(string $playerId, string $id, array $player, array &$state, Closure $cashFn, string $correlationId): array
    {
        $staffCfg = self::ISLAND_STAFF[$id] ?? throw new InvalidArgumentException('Unknown estate staff role.');
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $state['tornState']['staff'] = is_array($state['tornState']['staff'] ?? null) ? $state['tornState']['staff'] : [];
        if (!empty($state['tornState']['staff'][$id])) {
            throw new RuntimeException('This staff specialist is already hired.');
        }

        $cost = (int) $staffCfg['cost'];
        $cashFn(-$cost, 'torn.islandStaff:' . $id, $correlationId);
        $state['tornState']['staff'][$id] = true;

        if ($id === 'butler') {
            $newMaxHappy = max((int) $player['max_happy'], (int) $player['max_happy'] + 250);
            $newHappy = min($newMaxHappy, (int) $player['happy'] + 250);
            $this->database->execute(
                'UPDATE players SET max_happy = :mh, happy = :h WHERE id = :id',
                ['mh' => $newMaxHappy, 'h' => $newHappy, 'id' => $playerId],
            );
        }

        return [
            'cashDelta' => -$cost,
            'staffHired' => $id,
            'vaultCap' => self::vaultCap($state),
        ];
    }

    public function refillResourceWithPoints(string $playerId, string $bar, array $player, array &$state, string $correlationId): array
    {
        if (!in_array($bar, ['energy', 'nerve'], true)) {
            throw new InvalidArgumentException('Unsupported Points Building refill.');
        }
        $day = gmdate('Y-m-d');
        $todayUsed = is_array($state['pointsRefills'][$day] ?? null) ? $state['pointsRefills'][$day] : [];
        if (!empty($todayUsed[$bar])) {
            throw new RuntimeException('Daily ' . ucfirst($bar) . ' Point Refill already used today (resets 00:00 UTC).');
        }
        if ((int) ($state['points'] ?? 0) < 25) {
            throw new RuntimeException('Need 25 Points for a Points Building refill.');
        }

        $state['points'] = (int) $state['points'] - 25;
        $this->ledger->record($playerId, 'points', -25, (int) $state['points'], 'points.refill' . ucfirst($bar), $correlationId);

        // Keep only today's refill flags so state/cookie never bloats
        $todayUsed[$bar] = true;
        $state['pointsRefills'] = [$day => $todayUsed];

        if ($bar === 'energy') {
            $target = max((int) $player['max_energy'], 150, (int) $player['energy']);
            $this->database->execute('UPDATE players SET energy = :v WHERE id = :id', ['v' => $target, 'id' => $playerId]);
            return ['pointsSpent' => 25, 'restored' => ['energy' => $target - (int) $player['energy']]];
        }

        $target = max((int) $player['max_nerve'], (int) $player['nerve']);
        $this->database->execute('UPDATE players SET nerve = :v WHERE id = :id', ['v' => $target, 'id' => $playerId]);
        return ['pointsSpent' => 25, 'restored' => ['nerve' => $target - (int) $player['nerve']]];
    }

    public function museumExchange(string $playerId, string $id, array &$state, string $correlationId): array
    {
        if (empty($state['eduDone']['hist'])) {
            throw new RuntimeException('Complete History (hist) in University to unlock the Museum.');
        }
        $mode = strtolower(trim($id));
        if ($mode === '' || $mode === 'set' || $mode === 'plushies') {
            $keys = self::PLUSHIE_SET;
            $isPlushie = true;
        } elseif ($mode === 'flowers') {
            $keys = self::FLOWER_SET;
            $isPlushie = false;
        } else {
            throw new InvalidArgumentException('Museum exchange accepts "plushies" or "flowers".');
        }

        $state['inv'] = is_array($state['inv'] ?? null) ? $state['inv'] : [];
        $state['plushies'] = is_array($state['plushies'] ?? null) ? $state['plushies'] : [];

        foreach ($keys as $k) {
            $ownedInv = max(0, (int) ($state['inv'][$k] ?? 0));
            $ownedPlush = $isPlushie ? max(0, (int) ($state['plushies'][$k] ?? 0)) : 0;
            if ($ownedInv + $ownedPlush < 1) {
                throw new RuntimeException('Complete all 6 ' . ($isPlushie ? 'Plushies' : 'Flowers') . ' in the set before exchanging at the Museum.');
            }
        }

        foreach ($keys as $k) {
            if ((int) ($state['inv'][$k] ?? 0) >= 1) {
                $state['inv'][$k] = (int) $state['inv'][$k] - 1;
                $this->ledger->record($playerId, 'item:' . $k, -1, (int) $state['inv'][$k], 'museum.exchange', $correlationId);
            } else {
                $state['plushies'][$k] = max(0, (int) ($state['plushies'][$k] ?? 0) - 1);
            }
        }

        $state['points'] = (int) ($state['points'] ?? 0) + 10;
        $this->ledger->record($playerId, 'points', 10, (int) $state['points'], 'museum.exchange', $correlationId);

        return [
            'cashDelta' => 0,
            'pointsAwarded' => 10,
            'setExchanged' => $isPlushie ? 'plushies' : 'flowers',
        ];
    }

    public function casinoPlay(string $id, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $parts = explode(':', $id, 2);
        $game = strtolower(trim($parts[0] ?? 'slots'));
        $allowedGames = ['slots', 'roulette', 'wheel', 'rr', 'bookie', 'sportsbook'];
        if (!in_array($game, $allowedGames, true)) {
            throw new InvalidArgumentException('Unknown casino table.');
        }
        $wager = isset($parts[1]) && trim($parts[1]) !== ''
            ? self::parsePositiveInt($parts[1], 100, 50_000_000, 'Casino wager')
            : 1_000;

        // Deduct real wager upfront
        $cashFn(-$wager, 'torn.casinoPlay.bet:' . $game, $correlationId);

        $roll = $this->roll(1, 10000);
        $payout = 0;
        $outcome = 'lose';

        if ($game === 'rr') {
            if ($roll <= 5000) {
                $outcome = 'win';
                $payout = $wager * 2;
                $cashFn($payout, 'torn.casinoPlay.win:rr', $correlationId);
            } else {
                $outcome = 'hospitalized';
                $state['hospUntil'] = max((int) ($state['hospUntil'] ?? 0), $nowMs + 900_000); // 15m hosp
            }
        } else {
            // House-edge RNG (~96% RTP: 3% jackpot 4x + 42% win 2x = 45% hit rate, < 1.0 EV)
            if ($roll <= 300) {
                $outcome = 'jackpot';
                $payout = $wager * 4;
                $cashFn($payout, 'torn.casinoPlay.jackpot:' . $game, $correlationId);
            } elseif ($roll <= 4500) {
                $outcome = 'win';
                $payout = $wager * 2;
                $cashFn($payout, 'torn.casinoPlay.win:' . $game, $correlationId);
            }
        }

        return [
            'game' => $game,
            'wager' => $wager,
            'payout' => $payout,
            'cashDelta' => $payout - $wager,
            'outcome' => $outcome,
        ];
    }

    public function useLawyerCard(string $playerId, array &$state, int $nowMs, string $correlationId): array
    {
        if ((int) ($state['jailUntil'] ?? 0) <= $nowMs) {
            throw new RuntimeException('You are not currently in jail.');
        }
        if ((int) ($state['inv']['lawyer_card'] ?? 0) < 1) {
            throw new RuntimeException('You do not own a Lawyer Business Card.');
        }
        $state['inv']['lawyer_card'] = (int) $state['inv']['lawyer_card'] - 1;
        $this->ledger->record($playerId, 'item:lawyer_card', -1, (int) $state['inv']['lawyer_card'], 'torn.lawyerCard', $correlationId);
        $state['jailUntil'] = 0;

        return ['released' => true, 'itemConsumed' => 'lawyer_card'];
    }

    public function bloodBagAction(string $playerId, string $mode, array $player, array &$state, int $nowMs, string $correlationId): array
    {
        if ($mode === 'draw') {
            if ((int) ($state['jailUntil'] ?? 0) > $nowMs || (int) ($state['hospUntil'] ?? 0) > $nowMs) {
                throw new RuntimeException('Leave jail or hospital before drawing a Blood Bag.');
            }
            if (empty($state['eduDone']['bio']) && empty($state['eduDone']['med'])) {
                throw new RuntimeException('Complete Biology (bio) or Emergency Medicine (med) in University to draw Blood Bags.');
            }
            $minLife = (int) ceil((int) $player['max_life'] * 0.5);
            if ((int) $player['life'] < $minLife) {
                throw new RuntimeException('Need at least 50% Life to safely draw a Blood Bag.');
            }
            $lifeCost = max(1, (int) round((int) $player['max_life'] * 0.15));
            $newLife = max(1, (int) $player['life'] - $lifeCost);
            $this->database->execute('UPDATE players SET life = :life WHERE id = :id', ['life' => $newLife, 'id' => $playerId]);
            $state['inv']['bloodbag'] = (int) ($state['inv']['bloodbag'] ?? 0) + 1;
            $this->ledger->record($playerId, 'item:bloodbag', 1, (int) $state['inv']['bloodbag'], 'torn.bloodBag:draw', $correlationId);
            return ['mode' => 'draw', 'lifeSpent' => $lifeCost, 'granted' => 'bloodbag'];
        }

        if ((int) ($state['inv']['bloodbag'] ?? 0) < 1) {
            throw new RuntimeException('You do not own a Filled Blood Bag.');
        }
        self::enforceAndArmConsumableCooldown('bloodbag', 'medical', $state, $nowMs);
        $state['inv']['bloodbag'] = (int) $state['inv']['bloodbag'] - 1;
        $this->ledger->record($playerId, 'item:bloodbag', -1, (int) $state['inv']['bloodbag'], 'torn.bloodBag:' . $mode, $correlationId);

        $newLife = min((int) $player['max_life'], (int) $player['life'] + 300);
        $remHosp = max(0, (int) ($state['hospUntil'] ?? 0) - $nowMs);
        $hospReduced = min($remHosp, 3_600_000);
        if ($hospReduced > 0) {
            $state['hospUntil'] = $hospReduced >= $remHosp ? 0 : (int) $state['hospUntil'] - $hospReduced;
        }
        $this->database->execute('UPDATE players SET life = :life WHERE id = :id', ['life' => $newLife, 'id' => $playerId]);

        return [
            'mode' => $mode ?: 'use',
            'restored' => ['life' => $newLife - (int) $player['life']],
            'hospitalSecondsReduced' => (int) ceil($hospReduced / 1000),
        ];
    }

    public function readBook(string $playerId, string $id, array &$state, int $nowMs, string $correlationId): array
    {
        $bookId = trim($id) !== '' ? preg_replace('/[^a-zA-Z0-9_-]/', '', $id) : 'ugly_energy';
        if ($bookId === '') {
            throw new InvalidArgumentException('Invalid book identifier.');
        }
        $existing = $state['activeBook'] ?? ($state['tornState']['activeBook'] ?? null);
        if (is_array($existing) && (int) ($existing['endsAt'] ?? 0) > $nowMs) {
            throw new RuntimeException('You are already reading an active 31-day Syndicate Book.');
        }
        if ((int) ($state['points'] ?? 0) < 50) {
            throw new RuntimeException('Need 50 Points to begin studying a 31-day Syndicate Book.');
        }
        $state['points'] = (int) $state['points'] - 50;
        $this->ledger->record($playerId, 'points', -50, (int) $state['points'], 'torn.readBook:' . $bookId, $correlationId);

        $book = [
            'id' => $bookId,
            'startedAt' => $nowMs,
            'endsAt' => $nowMs + 31 * 86_400_000,
        ];
        $state['activeBook'] = $book;
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $state['tornState']['activeBook'] = $book;

        return ['pointsSpent' => 50, 'activeBook' => $book];
    }

    public function racewayRun(string $playerId, array $player, array &$state, Closure $cashFn, string $correlationId): array
    {
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $licenseFee = 0;
        if (empty($state['tornState']['raceCar']) || !is_array($state['tornState']['raceCar'])) {
            $licenseFee = 25_000;
            $cashFn(-$licenseFee, 'torn.racewayLicense', $correlationId);
            $state['tornState']['raceCar'] = [
                'class' => 'E',
                'model' => 'Civic Type-R',
                'points' => 0,
                'wins' => 0,
                'races' => 0,
            ];
        }
        if ((int) $player['energy'] < 10) {
            throw new RuntimeException('Need 10 Energy to enter a Raceway heat.');
        }
        $this->database->execute('UPDATE players SET energy = energy - 10 WHERE id = :id', ['id' => $playerId]);

        $skill = max(0, min(100, (int) ($state['skill']['racing'] ?? 0)));
        $mechBonus = !empty($state['eduDone']['mech']) ? 15 : 0;
        $score = $this->roll(1, 100) + intdiv($skill + $mechBonus, 3);
        $placement = $score >= 92 ? 1 : ($score >= 78 ? 2 : ($score >= 64 ? 3 : max(4, min(8, 10 - intdiv($score, 12)))));

        $purses = [1 => 12_000, 2 => 6_000, 3 => 3_000];
        $racePts = [1 => 3, 2 => 2, 3 => 1];
        $purse = $purses[$placement] ?? 0;
        if ($purse > 0) {
            $cashFn($purse, 'torn.racewayPodium:' . $placement, $correlationId);
        }

        $newSkill = min(100, $skill + 1);
        $state['skill']['racing'] = $newSkill;
        $state['tornState']['raceCar']['races'] = (int) ($state['tornState']['raceCar']['races'] ?? 0) + 1;
        $state['tornState']['raceCar']['points'] = (int) ($state['tornState']['raceCar']['points'] ?? 0) + ($racePts[$placement] ?? 0);
        if ($placement === 1) {
            $state['tornState']['raceCar']['wins'] = (int) ($state['tornState']['raceCar']['wins'] ?? 0) + 1;
        }
        if ((int) $state['tornState']['raceCar']['points'] >= 25) {
            $state['tornState']['raceCar']['class'] = 'A';
        } elseif ((int) $state['tornState']['raceCar']['points'] >= 10) {
            $state['tornState']['raceCar']['class'] = 'C';
        }

        return [
            'cashDelta' => $purse - $licenseFee,
            'licenseFee' => $licenseFee,
            'purse' => $purse,
            'placement' => $placement,
            'racingSkill' => $newSkill,
            'raceCar' => $state['tornState']['raceCar'],
        ];
    }

    public function oc2Spawn(string $playerId, string $id, array $player, array &$state, int $nowMs): array
    {
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $cdUntil = (int) ($state['tornState']['ocCooldownUntil'] ?? 0);
        if ($cdUntil > $nowMs) {
            $remSec = (int) ceil(($cdUntil - $nowMs) / 1000);
            throw new RuntimeException("Organized Crime crew is on cooldown ({$remSec}s remaining).");
        }
        if (is_array($state['tornState']['oc2Plan'] ?? null)) {
            throw new RuntimeException('An Organized Crime heist is already planned.');
        }
        if ((int) ($state['fac']['respect'] ?? 0) < 50) {
            throw new RuntimeException('Need at least 50 Faction Respect to plan an Organized Crime.');
        }
        if ((int) $player['nerve'] < 10) {
            throw new RuntimeException('Need 10 Nerve to scope and plan an Organized Crime.');
        }

        $scenario = trim($id) !== '' ? preg_replace('/[^a-zA-Z0-9_-]/', '', $id) : 'cracking_the_vault';
        $this->database->execute('UPDATE players SET nerve = nerve - 10 WHERE id = :id', ['id' => $playerId]);

        $plan = [
            'scenario' => $scenario,
            'plannedAt' => $nowMs,
            'readyAt' => $nowMs + 300_000, // 5m planning window
        ];
        $state['tornState']['activeOc2'] = $scenario;
        $state['tornState']['oc2Plan'] = $plan;

        return ['cashDelta' => 0, 'nerveSpent' => 10, 'oc2Plan' => $plan];
    }

    public function oc2Heist(string $playerId, array $player, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $plan = $state['tornState']['oc2Plan'] ?? null;
        if (!is_array($plan) || empty($plan['scenario'])) {
            throw new RuntimeException('Plan an Organized Crime (torn.oc2Spawn) before executing the heist.');
        }
        if ($nowMs < (int) ($plan['readyAt'] ?? PHP_INT_MAX)) {
            $remSec = (int) ceil(((int) $plan['readyAt'] - $nowMs) / 1000);
            throw new RuntimeException("Organized Crime planning still underway ({$remSec}s remaining).");
        }
        if ((int) $player['energy'] < 15) {
            throw new RuntimeException('Need 15 Energy to execute the Organized Crime heist.');
        }

        $this->database->execute('UPDATE players SET energy = energy - 15 WHERE id = :id', ['id' => $playerId]);
        $scenario = (string) $plan['scenario'];
        unset($state['tornState']['oc2Plan']);
        $state['tornState']['activeOc2'] = null;
        $state['tornState']['ocCooldownUntil'] = $nowMs + 6 * 3_600_000; // 6h OC cooldown

        if ($this->roll(1, 100) <= 75) {
            $leadMult = !empty($state['eduDone']['lead']) ? 1.10 : 1.0;
            $payout = (int) round(45_000 * $leadMult);
            $respect = (int) round(25 * $leadMult);
            $cashFn($payout, 'torn.oc2Heist:' . $scenario, $correlationId);
            $state['fac']['respect'] = (int) ($state['fac']['respect'] ?? 0) + $respect;
            $state['crimeXp'] = (int) ($state['crimeXp'] ?? 96) + 30;
            return ['cashDelta' => $payout, 'success' => true, 'respectEarned' => $respect, 'scenario' => $scenario];
        }

        $jailMult = !empty($state['eduDone']['law']) ? 0.85 : 1.0;
        $state['jailUntil'] = max((int) ($state['jailUntil'] ?? 0), $nowMs + (int) round(600_000 * $jailMult)); // 10m jail
        return ['cashDelta' => 0, 'success' => false, 'jailed' => true, 'scenario' => $scenario];
    }

    public function racketCollect(string $playerId, array $player, array &$state, int $nowMs, Closure $cashFn, string $correlationId): array
    {
        $state['tornState'] = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $cdUntil = (int) ($state['tornState']['racketCooldownUntil'] ?? 0);
        if ($cdUntil > $nowMs) {
            $remSec = (int) ceil(($cdUntil - $nowMs) / 1000);
            throw new RuntimeException("Territory racket tribute is on cooldown ({$remSec}s remaining).");
        }
        if ((int) ($state['fac']['respect'] ?? 0) < 250) {
            throw new RuntimeException('Need at least 250 Faction Respect to collect a territory racket.');
        }
        if ((int) $player['energy'] < 10) {
            throw new RuntimeException('Need 10 Energy to enforce racket collection.');
        }
        $this->database->execute('UPDATE players SET energy = energy - 10 WHERE id = :id', ['id' => $playerId]);
        $state['tornState']['racketCooldownUntil'] = $nowMs + 6 * 3_600_000; // 6h cooldown

        $payout = 15_000;
        $cashFn($payout, 'torn.racketCollect', $correlationId);
        $state['points'] = (int) ($state['points'] ?? 0) + 3;
        $this->ledger->record($playerId, 'points', 3, (int) $state['points'], 'torn.racketCollect', $correlationId);

        return ['cashDelta' => $payout, 'pointsAwarded' => 3];
    }

    public function upgradeMerit(string $playerId, string $id, array $player, array &$state): array
    {
        if (!in_array($id, self::MERIT_KEYS, true)) {
            throw new InvalidArgumentException('Unknown merit upgrade key.');
        }
        $state['meritTree'] = is_array($state['meritTree'] ?? null) ? $state['meritTree'] : [];
        $lvl = max(0, (int) ($state['meritTree'][$id] ?? 0));
        if ($lvl >= 10) {
            throw new RuntimeException('Skill already at max tier (10/10).');
        }
        $cost = $lvl + 1;
        if ((int) ($state['merits'] ?? 0) < $cost) {
            throw new RuntimeException("Not enough merits (need {$cost}).");
        }

        $state['merits'] = (int) $state['merits'] - $cost;
        $state['meritTree'][$id] = $lvl + 1;

        if (in_array($id, ['nerve', 'nerve_bar'], true)) {
            $state['meritNerveApplied'] = (int) ($state['meritNerveApplied'] ?? 0) + 1;
            $this->database->execute('UPDATE players SET max_nerve = max_nerve + 1 WHERE id = :id', ['id' => $playerId]);
        } elseif (in_array($id, ['life', 'life_points'], true)) {
            $bonusLife = max(5, (int) round(250 * 0.05));
            $state['meritLifeApplied'] = (int) ($state['meritLifeApplied'] ?? 0) + $bonusLife;
            $this->database->execute('UPDATE players SET max_life = max_life + :b WHERE id = :id', ['b' => $bonusLife, 'id' => $playerId]);
        }

        return [
            'meritKey' => $id,
            'newRank' => $lvl + 1,
            'meritsSpent' => $cost,
            'meritsRemaining' => (int) $state['merits'],
        ];
    }

    public function resetMerits(string $playerId, array $player, array &$state, string $correlationId): array
    {
        $tree = is_array($state['meritTree'] ?? null) ? $state['meritTree'] : [];
        $refund = 0;
        foreach ($tree as $rank) {
            $r = max(0, min(10, (int) $rank));
            $refund += intdiv($r * ($r + 1), 2);
        }
        if ($refund <= 0) {
            throw new RuntimeException('No spent merits to reset.');
        }

        $pointsCost = 0;
        if (!empty($state['meritFreeResetUsed'])) {
            $pointsCost = 250;
            if ((int) ($state['points'] ?? 0) < $pointsCost) {
                throw new RuntimeException('Need 250 Points to reset Merits (free reset already used).');
            }
            $state['points'] = (int) $state['points'] - $pointsCost;
            $this->ledger->record($playerId, 'points', -$pointsCost, (int) $state['points'], 'merit.reset', $correlationId);
        } else {
            $state['meritFreeResetUsed'] = true;
        }

        $nerveApplied = max(0, (int) ($state['meritNerveApplied'] ?? 0));
        $lifeApplied = max(0, (int) ($state['meritLifeApplied'] ?? 0));
        if ($nerveApplied > 0 || $lifeApplied > 0) {
            $newMaxNerve = max(15, (int) $player['max_nerve'] - $nerveApplied);
            $newMaxLife = max(100, (int) $player['max_life'] - $lifeApplied);
            $this->database->execute(
                'UPDATE players SET max_nerve = :mn, nerve = MIN(nerve, :mn), max_life = :ml, life = MIN(life, :ml) WHERE id = :id',
                ['mn' => $newMaxNerve, 'ml' => $newMaxLife, 'id' => $playerId],
            );
            $state['meritNerveApplied'] = 0;
            $state['meritLifeApplied'] = 0;
        }

        $state['meritTree'] = [];
        $state['merits'] = (int) ($state['merits'] ?? 0) + $refund;

        return [
            'meritsRefunded' => $refund,
            'pointsSpent' => $pointsCost,
            'meritsAvailable' => (int) $state['merits'],
        ];
    }

    public static function awardWorkShiftStats(array &$state, array $jobsCatalog, int $shifts = 1): void
    {
        $jobId = (string) ($state['job'] ?? 'grocer');
        $defaults = [
            'grocer' => [4, 2, 5],
            'casino' => [3, 6, 8],
            'clinic' => [4, 14, 10],
            'army'   => [16, 6, 14],
            'edu'    => [4, 20, 12],
            'firm'   => [8, 28, 22],
        ];
        [$man, $int, $end] = $defaults[$jobId] ?? [6, 6, 6];
        foreach ($jobsCatalog as $row) {
            if (($row['id'] ?? '') === $jobId && (isset($row['man']) || isset($row['int']) || isset($row['end']))) {
                $man = (int) ($row['man'] ?? $man);
                $int = (int) ($row['int'] ?? $int);
                $end = (int) ($row['end'] ?? $end);
                break;
            }
        }
        $mult = !empty($state['eduDone']['gen']) ? 1.10 : 1.0;
        $ws = is_array($state['workStats'] ?? null) ? $state['workStats'] : ['man' => 0, 'int' => 0, 'end' => 0];
        $ws['man'] = (int) ($ws['man'] ?? 0) + (int) round($man * $shifts * $mult);
        $ws['int'] = (int) ($ws['int'] ?? 0) + (int) round($int * $shifts * $mult);
        $ws['end'] = (int) ($ws['end'] ?? 0) + (int) round($end * $shifts * $mult);
        $state['workStats'] = $ws;
    }

    public static function buildTornV2(array $player, array $state, int $nowMs): array
    {
        $unixSec = intdiv($nowMs, 1000);
        $cds = is_array($state['cooldowns'] ?? null) ? $state['cooldowns'] : [];
        $addiction = max(0, (int) ($state['addiction'] ?? ($cds['addiction'] ?? 0)));

        $stocksOut = [];
        foreach (array_keys(self::STOCKS) as $ticker) {
            $q = self::stockQuote($ticker, $unixSec);
            $hold = is_array($state['stocks'][$ticker] ?? null) ? $state['stocks'][$ticker] : [];
            $owned = max(0, (int) ($hold['shares'] ?? 0));
            $readyAt = max(0, (int) ($hold['blockReadyAt'] ?? 0));
            $blockOwned = $owned >= $q['blockShares'];
            $stocksOut[] = [
                ...$q,
                'ownedShares' => $owned,
                'avgCost' => (float) ($hold['avgCost'] ?? 0.0),
                'blockOwned' => $blockOwned,
                'blockReadyAt' => $readyAt,
                'blockReady' => $blockOwned && $readyAt > 0 && $nowMs >= $readyAt,
                'cooldownSeconds' => $blockOwned ? max(0, (int) ceil(($readyAt - $nowMs) / 1000)) : 0,
            ];
        }

        $rawCd = $state['activeCd'] ?? ($state['tornState']['activeCd'] ?? null);
        $activeCd = null;
        if (is_array($rawCd) && !empty($rawCd['principal'])) {
            $maturesAt = (int) ($rawCd['maturesAt'] ?? 0);
            $activeCd = [
                ...$rawCd,
                'remainingSeconds' => max(0, (int) ceil(($maturesAt - $nowMs) / 1000)),
                'matured' => $nowMs >= $maturesAt,
            ];
        }

        $crimes2Out = [];
        foreach (self::CRIMES_2 as $cid => $cfg) {
            $sKey = 'crime2_' . $cfg['key'];
            $enhId = $cfg['enhancerId'];
            $crimes2Out[] = [
                'id' => (string) $cid,
                'key' => $cfg['key'],
                'name' => $cfg['name'],
                'nerve' => $cfg['nerve'],
                'baseCash' => $cfg['cash'],
                'xp' => $cfg['xp'],
                'skill' => max(0, min(100, (int) ($state['skill'][$sKey] ?? 0))),
                'enhancerId' => $enhId,
                'enhancerLabel' => $cfg['enhancer'],
                'enhancerOwned' => (int) ($state['inv'][$enhId] ?? 0) > 0,
            ];
        }

        $day = gmdate('Y-m-d');
        $refillsToday = is_array($state['pointsRefills'][$day] ?? null) ? $state['pointsRefills'][$day] : [];

        $plushOwned = [];
        $plushSets = PHP_INT_MAX;
        foreach (self::PLUSHIE_SET as $pk) {
            $cnt = max(0, (int) ($state['inv'][$pk] ?? 0)) + max(0, (int) ($state['plushies'][$pk] ?? 0));
            $plushOwned[$pk] = $cnt;
            $plushSets = min($plushSets, $cnt);
        }
        $flowerOwned = [];
        $flowerSets = PHP_INT_MAX;
        foreach (self::FLOWER_SET as $fk) {
            $cnt = max(0, (int) ($state['inv'][$fk] ?? 0));
            $flowerOwned[$fk] = $cnt;
            $flowerSets = min($flowerSets, $cnt);
        }

        $rawBook = $state['activeBook'] ?? ($state['tornState']['activeBook'] ?? null);
        $activeBook = null;
        if (is_array($rawBook) && !empty($rawBook['id'])) {
            $endsAt = (int) ($rawBook['endsAt'] ?? 0);
            if ($endsAt > $nowMs) {
                $activeBook = [
                    ...$rawBook,
                    'remainingSeconds' => max(0, (int) ceil(($endsAt - $nowMs) / 1000)),
                ];
            }
        }

        $ts = is_array($state['tornState'] ?? null) ? $state['tornState'] : [];
        $ocPlan = is_array($ts['oc2Plan'] ?? null) ? $ts['oc2Plan'] : null;
        $spentMerits = 0;
        foreach ((is_array($state['meritTree'] ?? null) ? $state['meritTree'] : []) as $rk) {
            $r = max(0, min(10, (int) $rk));
            $spentMerits += intdiv($r * ($r + 1), 2);
        }

        return [
            'version' => 'ZONE-TORN-148',
            'harvestedEndpoints' => 57,
            'cooldowns' => [
                'drugSeconds' => max(0, (int) ceil(((int) ($cds['drugUntil'] ?? 0) - $nowMs) / 1000)),
                'medicalSeconds' => max(0, (int) ceil(((int) ($cds['medicalUntil'] ?? 0) - $nowMs) / 1000)),
                'medicalMaxSeconds' => intdiv(self::MAX_MEDICAL_CD_MS, 1000),
                'boosterSeconds' => max(0, (int) ceil(((int) ($cds['boosterUntil'] ?? 0) - $nowMs) / 1000)),
                'boosterMaxSeconds' => intdiv(self::MAX_BOOSTER_CD_MS, 1000),
                'overdoseCount' => max(0, (int) ($cds['overdoseCount'] ?? 0)),
            ],
            'addiction' => $addiction,
            'rehabCost' => max(10_000, $addiction * 15_000),
            'stocks' => $stocksOut,
            'activeCd' => $activeCd,
            'vaultBalance' => max(0, (int) ($state['vaultBalance'] ?? 0)),
            'vaultCap' => self::vaultCap($state),
            'islandStaff' => [
                'hired' => is_array($ts['staff'] ?? null) ? $ts['staff'] : [],
                'catalog' => self::ISLAND_STAFF,
            ],
            'crimes2CatalogWithSkill' => $crimes2Out,
            'shopliftingSecurity' => self::shopliftingSecurity($unixSec),
            'searchForCashModifiers' => self::searchForCashModifiers($unixSec),
            'pointsRefillsUsedToday' => [
                'day' => $day,
                'energy' => !empty($refillsToday['energy']),
                'nerve' => !empty($refillsToday['nerve']),
                'costPoints' => 25,
            ],
            'museum' => [
                'unlocked' => !empty($state['eduDone']['hist']),
                'plushieSetsReady' => $plushSets === PHP_INT_MAX ? 0 : $plushSets,
                'flowerSetsReady' => $flowerSets === PHP_INT_MAX ? 0 : $flowerSets,
                'plushiesOwned' => $plushOwned,
                'flowersOwned' => $flowerOwned,
            ],
            'raceState' => [
                'hasLicense' => is_array($ts['raceCar'] ?? null),
                'licenseCost' => 25_000,
                'skill' => max(0, min(100, (int) ($state['skill']['racing'] ?? 0))),
                'car' => $ts['raceCar'] ?? null,
            ],
            'activeBook' => $activeBook,
            'oc2State' => [
                'plan' => $ocPlan === null ? null : [
                    ...$ocPlan,
                    'ready' => $nowMs >= (int) ($ocPlan['readyAt'] ?? 0),
                    'remainingSeconds' => max(0, (int) ceil(((int) ($ocPlan['readyAt'] ?? 0) - $nowMs) / 1000)),
                ],
                'cooldownSeconds' => max(0, (int) ceil(((int) ($ts['ocCooldownUntil'] ?? 0) - $nowMs) / 1000)),
                'racketCooldownSeconds' => max(0, (int) ceil(((int) ($ts['racketCooldownUntil'] ?? 0) - $nowMs) / 1000)),
            ],
            'workStats' => is_array($state['workStats'] ?? null) ? $state['workStats'] : ['man' => 0, 'int' => 0, 'end' => 0],
            'meritReset' => [
                'freeResetAvailable' => empty($state['meritFreeResetUsed']),
                'resetCostPoints' => 250,
                'spentMerits' => $spentMerits,
            ],
            'recentPvpAttacks' => [
                ['code' => '7535bd3978cc', 'attacker' => 'Vincenzo [#1042]', 'defender' => 'Rayan_Black [#1088]', 'result' => 'Hospitalized', 'respectGain' => 3.82, 'fairFight' => 2.45],
                ['code' => '3c6496fd3b16', 'attacker' => 'Vincenzo [#1042]', 'defender' => 'Duke_X [#1337]', 'result' => 'Mugged', 'respectGain' => 2.64, 'fairFight' => 1.88],
            ],
        ];
    }
}

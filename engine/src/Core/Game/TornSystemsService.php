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
        '1' => ['key' => 'search_cash', 'name' => 'Search for Cash', 'nerve' => 2, 'cash' => 450, 'maxSkillCash' => 2550, 'xp' => 6, 'playerXp' => 18, 'reqLevel' => 1, 'reqCrimeXp' => 0, 'enhancerId' => 'glasses', 'enhancer' => 'Glasses (#564)', 'loot' => 'plush_camel', 'diffBps' => 0, 'penalty' => 'jail'],
        '2' => ['key' => 'bootlegging', 'name' => 'Bootlegging', 'nerve' => 3, 'cash' => 850, 'maxSkillCash' => 3400, 'xp' => 8, 'playerXp' => 22, 'reqLevel' => 1, 'reqCrimeXp' => 0, 'enhancerId' => 'high_speed_drive', 'enhancer' => 'High-Speed Drive (#565)', 'loot' => 'lollipop', 'diffBps' => 200, 'penalty' => 'jail'],
        '3' => ['key' => 'graffiti', 'name' => 'Graffiti', 'nerve' => 3, 'cash' => 1050, 'maxSkillCash' => 4100, 'xp' => 9, 'playerXp' => 25, 'reqLevel' => 1, 'reqCrimeXp' => 0, 'enhancerId' => 'paint_mask', 'enhancer' => 'Paint Mask (#550)', 'loot' => 'cannabis', 'diffBps' => 300, 'penalty' => 'jail'],
        '4' => ['key' => 'shoplifting', 'name' => 'Shoplifting', 'nerve' => 4, 'cash' => 1850, 'maxSkillCash' => 6200, 'xp' => 11, 'playerXp' => 30, 'reqLevel' => 3, 'reqCrimeXp' => 200, 'enhancerId' => 'mountain_bike', 'enhancer' => 'Mountain Bike (#566)', 'loot' => 'energydrink', 'diffBps' => 500, 'penalty' => 'jail'],
        '5' => ['key' => 'pickpocketing', 'name' => 'Pickpocketing', 'nerve' => 5, 'cash' => 2900, 'maxSkillCash' => 9200, 'xp' => 14, 'playerXp' => 36, 'reqLevel' => 3, 'reqCrimeXp' => 200, 'enhancerId' => 'cut_throat_razor', 'enhancer' => 'Cut-Throat Razor (#567)', 'loot' => 'vicodin', 'diffBps' => 700, 'penalty' => 'hosp'],
        '6' => ['key' => 'card_skimming', 'name' => 'Card Skimming', 'nerve' => 6, 'cash' => 4600, 'maxSkillCash' => 13500, 'xp' => 18, 'playerXp' => 44, 'reqLevel' => 3, 'reqCrimeXp' => 200, 'enhancerId' => 'duct_tape', 'enhancer' => 'Duct Tape (#571)', 'loot' => 'lsd', 'diffBps' => 900, 'penalty' => 'jail'],
        '7' => ['key' => 'burglary', 'name' => 'Burglary', 'nerve' => 6, 'cash' => 7200, 'maxSkillCash' => 18500, 'xp' => 20, 'playerXp' => 52, 'reqLevel' => 6, 'reqCrimeXp' => 450, 'enhancerId' => 'flashlight', 'enhancer' => 'Flashlight (#572)', 'loot' => 'bloodbag', 'diffBps' => 1100, 'penalty' => 'hosp'],
        '8' => ['key' => 'hustling', 'name' => 'Hustling', 'nerve' => 4, 'cash' => 5400, 'maxSkillCash' => 14200, 'xp' => 15, 'playerXp' => 42, 'reqLevel' => 6, 'reqCrimeXp' => 450, 'enhancerId' => 'megaphone', 'enhancer' => 'Megaphone (#573)', 'loot' => 'ecstasy', 'diffBps' => 800, 'penalty' => 'jail'],
        '9' => ['key' => 'disposal', 'name' => 'Disposal', 'nerve' => 6, 'cash' => 9800, 'maxSkillCash' => 23500, 'xp' => 22, 'playerXp' => 60, 'reqLevel' => 6, 'reqCrimeXp' => 450, 'enhancerId' => 'latex_gloves', 'enhancer' => 'Latex Gloves (#574)', 'loot' => 'morphine', 'diffBps' => 1200, 'penalty' => 'hosp'],
        '10' => ['key' => 'cracking', 'name' => 'Cracking', 'nerve' => 7, 'cash' => 14500, 'maxSkillCash' => 32000, 'xp' => 25, 'playerXp' => 72, 'reqLevel' => 10, 'reqCrimeXp' => 900, 'enhancerId' => 'office_chair', 'enhancer' => 'Office Chair (#575)', 'loot' => 'flash_grenade', 'diffBps' => 1400, 'penalty' => 'jail'],
        '11' => ['key' => 'forgery', 'name' => 'Forgery', 'nerve' => 5, 'cash' => 11800, 'maxSkillCash' => 26500, 'xp' => 21, 'playerXp' => 60, 'reqLevel' => 10, 'reqCrimeXp' => 900, 'enhancerId' => 'magnifying_glass', 'enhancer' => 'Magnifying Glass (#576)', 'loot' => 'lawyer_card', 'diffBps' => 1250, 'penalty' => 'jail'],
        '12' => ['key' => 'scamming', 'name' => 'Scamming', 'nerve' => 7, 'cash' => 19500, 'maxSkillCash' => 40000, 'xp' => 28, 'playerXp' => 85, 'reqLevel' => 10, 'reqCrimeXp' => 900, 'enhancerId' => 'ergonomic_keyboard', 'enhancer' => 'Ergonomic Keyboard (#577)', 'loot' => 'edvd', 'diffBps' => 1550, 'penalty' => 'jail'],
        '13' => ['key' => 'arson', 'name' => 'Arson', 'nerve' => 9, 'cash' => 30000, 'maxSkillCash' => 52000, 'xp' => 36, 'playerXp' => 115, 'reqLevel' => 14, 'reqCrimeXp' => 1600, 'enhancerId' => 'windproof_lighter', 'enhancer' => 'Windproof Lighter (#544)', 'loot' => 'xanax', 'diffBps' => 1800, 'penalty' => 'hosp'],
    ];

    public const LEVEL_GATE_SPECS = [
        'dump' => ['requiredLevel' => 2, 'feature' => 'City Dump', 'featureAr' => 'مكب المدينة', 'route' => 'city'],
        'spinWheels' => ['requiredLevel' => 3, 'feature' => 'Daily Spin Wheels', 'featureAr' => 'عجلات الحظ اليومية', 'route' => 'casino'],
        'bazaar' => ['requiredLevel' => 5, 'feature' => 'Personal Bazaars', 'featureAr' => 'البازارات الشخصية', 'route' => 'market'],
        'trades' => ['requiredLevel' => 5, 'feature' => '2-Player Direct Trades', 'featureAr' => 'التبادل المباشر بين اللاعبين', 'route' => 'market'],
        'fixerContracts' => ['requiredLevel' => 7, 'feature' => 'NPC Fixer Contracts', 'featureAr' => 'عقود وكلاء المهام', 'route' => 'missions'],
        'companies' => ['requiredLevel' => 10, 'feature' => 'Player Companies', 'featureAr' => 'شركات اللاعبين', 'route' => 'jobs'],
        'bankCd' => ['requiredLevel' => 10, 'feature' => 'Bank Term CDs', 'featureAr' => 'شهادات الإيداع البنكية', 'route' => 'bank'],
        'stockExchange' => ['requiredLevel' => 12, 'feature' => 'Stock Exchange', 'featureAr' => 'بورصة الأسهم', 'route' => 'bank'],
        'foreignTravel' => ['requiredLevel' => 15, 'feature' => 'International Airport Flights', 'featureAr' => 'رحلات المطار الدولي', 'route' => 'city'],
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

    public static function buildLevelGates(int $playerLevel): array
    {
        $lvl = max(1, $playerLevel);
        $gates = [];
        foreach (self::LEVEL_GATE_SPECS as $key => $spec) {
            $req = (int) $spec['requiredLevel'];
            $unlocked = $lvl >= $req;
            $gates[$key] = [
                'id' => $key,
                'requiredLevel' => $req,
                'currentLevel' => $lvl,
                'unlocked' => $unlocked,
                'feature' => $spec['feature'],
                'featureAr' => $spec['featureAr'],
                'route' => $spec['route'],
                'lockMessage' => $unlocked
                    ? null
                    : "Locked: Reach Level {$req} to unlock {$spec['feature']} (Current: Lv {$lvl}).",
            ];
        }
        return $gates;
    }

    public static function assertLevelUnlocked(int $playerLevel, int $requiredLevel, string $feature): void
    {
        $lvl = max(1, $playerLevel);
        if ($lvl < $requiredLevel) {
            throw new RuntimeException("Locked: Reach Level {$requiredLevel} to unlock {$feature} (Current: Lv {$lvl}).");
        }
    }

    public static function isCrime2Unlocked(string $crimeId, int $playerLevel, int $crimeXp): bool
    {
        $cfg = self::CRIMES_2[$crimeId] ?? null;
        if ($cfg === null) {
            return false;
        }
        $reqLevel = (int) ($cfg['reqLevel'] ?? 1);
        $reqCrimeXp = (int) ($cfg['reqCrimeXp'] ?? 0);
        if (max(1, $playerLevel) >= $reqLevel) {
            return true;
        }
        return $reqCrimeXp > 0 && $crimeXp >= $reqCrimeXp;
    }

    public static function assertCrime2Unlocked(string $crimeId, int $playerLevel, int $crimeXp): void
    {
        $cfg = self::CRIMES_2[$crimeId] ?? null;
        if ($cfg === null) {
            throw new InvalidArgumentException('Unknown Crimes 2.0 archetype.');
        }
        if (self::isCrime2Unlocked($crimeId, $playerLevel, $crimeXp)) {
            return;
        }
        $lvl = max(1, $playerLevel);
        $reqLevel = (int) ($cfg['reqLevel'] ?? 1);
        $reqCrimeXp = (int) ($cfg['reqCrimeXp'] ?? 0);
        throw new RuntimeException(
            "Locked: Reach Level {$reqLevel} (or {$reqCrimeXp} Crime XP) to unlock {$cfg['name']} (Current: Lv {$lvl}, {$crimeXp} Crime XP)."
        );
    }

    /**
     * Unified live formula resolver for all 24 Skill Tree nodes, 4 Origins, 5 Street Crew slots, and Nemesis Heat Tax.
     *
     * @return array<string, mixed>
     */
    public static function extractLiveModifiers(array $state, int $nowMs = 0): array
    {
        $nowSec = $nowMs > 100_000_000_000 ? intdiv($nowMs, 1000) : ($nowMs > 0 ? $nowMs : time());

        $rawNodes = is_array($state['rpg']['unlockedNodes'] ?? null) ? $state['rpg']['unlockedNodes'] : [];
        $nodes = [];
        foreach ($rawNodes as $k => $v) {
            if (is_int($k) && is_string($v) && $v !== '') {
                $nodes[$v] = true;
            } elseif (is_string($k) && $k !== '' && $v) {
                $nodes[$k] = true;
            }
        }
        $has = static fn (string $id): bool => !empty($nodes[$id]);

        $asc = is_array($state['ascension'] ?? null) ? $state['ascension'] : [];
        $rawOrigin = $asc['origin'] ?? ($asc['originId'] ?? null);
        if (is_array($rawOrigin)) {
            $originId = is_string($rawOrigin['id'] ?? null) ? $rawOrigin['id'] : null;
        } else {
            $originId = is_string($rawOrigin) && $rawOrigin !== '' ? $rawOrigin : null;
        }

        $rawCrew = is_array($asc['crew'] ?? null) ? $asc['crew'] : [];
        $crewRank = static function (string $slot) use ($rawCrew): int {
            $entry = $rawCrew[$slot] ?? 0;
            if (is_array($entry)) {
                return max(0, min(5, (int) ($entry['rank'] ?? $entry['level'] ?? 0)));
            }
            return max(0, min(5, (int) $entry));
        };
        $lookoutRank = $crewRank('lookout');
        $wheelmanRank = $crewRank('wheelman');
        $chemistRank = $crewRank('chemist');
        $enforcerRank = $crewRank('enforcer');
        $consigliereRank = $crewRank('consigliere');

        // 1) Shadow Mastermind + harbor_ghost + lookout crew
        $crimeSuccessPct = ($has('street_instinct') ? 4 : 0)
            + ($has('wiretapper') ? 4 : 0)
            + ($has('master_burglar') ? 4 : 0)
            + ($has('nerve_overclock') ? 2 : 0)
            + ($has('ghost_protocol') ? 8 : 0)
            + ($originId === 'harbor_ghost' ? 8 : 0)
            + ($lookoutRank * 3);
        $crimeSuccessPct = min(40, $crimeSuccessPct);

        $crimeUniquePct = ($has('street_instinct') ? 2 : 0)
            + ($has('wiretapper') ? 2 : 0)
            + ($has('master_burglar') ? 4 : 0)
            + ($has('ghost_protocol') ? 6 : 0)
            + ($originId === 'harbor_ghost' ? 4 : 0)
            + ($lookoutRank * 2);
        $crimeUniquePct = min(28, $crimeUniquePct);

        $crimeCashPct = ($has('street_instinct') ? 3 : 0)
            + ($has('master_burglar') ? 4 : 0)
            + ($has('ghost_protocol') ? 5 : 0)
            + ($originId === 'harbor_ghost' ? 4 : 0)
            + ($lookoutRank * 2);
        $crimeCashPct = min(30, $crimeCashPct);

        $stealthPct = ($has('silent_footsteps') ? 6 : 0)
            + ($has('master_burglar') ? 6 : 0)
            + ($has('ghost_protocol') ? 8 : 0)
            + ($originId === 'harbor_ghost' ? 10 : 0)
            + ($wheelmanRank * 3);

        // Nemesis Heat Tax (skims 2%..10% of street crime cash when un-cleared)
        $nem = is_array($asc['nemesis'] ?? null) ? $asc['nemesis'] : [];
        $rawCleared = max(
            0,
            (int) ($nem['heatClearedUntil'] ?? $nem['clearedUntil'] ?? $nem['taxClearedUntil'] ?? $nem['suppressedUntil'] ?? 0),
        );
        $clearedSec = $rawCleared > 100_000_000_000 ? intdiv($rawCleared, 1000) : $rawCleared;
        $isHeatCleared = ($clearedSec > $nowSec) || !empty($nem['cleared']) || !empty($nem['defeated']);
        if ($isHeatCleared) {
            $nemesisHeatTaxPct = 0;
        } else {
            $explicitHeat = (int) ($nem['heatTaxPct'] ?? 0);
            if ($explicitHeat === 0 && $clearedSec > 0 && isset($nem['baseHeatTaxPct'])) {
                $explicitHeat = (int) $nem['baseHeatTaxPct'];
            }
            $nemesisHeatTaxPct = max(0, min(10, $explicitHeat));
        }

        // 2) Syndicate Mogul + disgraced_banker + consigliere crew + wheelman
        $bankAprBonusPct = ($has('compound_ledger') ? 5 : 0)
            + ($has('tax_shelter') ? 5 : 0)
            + ($has('central_banker') ? 10 : 0)
            + ($originId === 'disgraced_banker' ? 8 : 0)
            + ($consigliereRank * 4);
        $bankAprBonusPct = min(45, $bankAprBonusPct);

        $stockFeeReductionPct = ($has('insider_tape') ? 25 : 0)
            + ($has('tax_shelter') ? 10 : 0)
            + ($has('central_banker') ? 25 : 0)
            + ($originId === 'disgraced_banker' ? 20 : 0)
            + ($consigliereRank * 5);
        $stockFeeReductionPct = min(50, $stockFeeReductionPct);

        $vaultCapBonusPct = ($has('offshore_vault') ? 10 : 0)
            + ($has('central_banker') ? 15 : 0)
            + ($originId === 'disgraced_banker' ? 8 : 0)
            + ($consigliereRank * 4);
        $vaultCapBonusPct = min(55, $vaultCapBonusPct);

        $jobPayBonusPct = ($has('offshore_vault') ? 8 : 0)
            + ($has('central_banker') ? 12 : 0)
            + ($consigliereRank * 4);
        $jobPayBonusPct = min(40, $jobPayBonusPct);

        $mogulLuggageBonus = ($has('airstrip_logistics') ? 2 : 0)
            + ($has('central_banker') ? 3 : 0);

        $flightTimeReductionPct = min(15, $wheelmanRank * 3);

        // 3) Bio-Alchemist + street_chemist + chemist crew
        $odReductionPct = ($has('micro_dosing') ? 15 : 0)
            + ($has('pure_synthesis') ? 12 : 0)
            + ($has('endorphin_lock') ? 5 : 0)
            + ($has('adrenal_surge') ? 8 : 0)
            + ($has('bio_synthetic') ? 15 : 0)
            + ($originId === 'street_chemist' ? 20 : 0)
            + ($chemistRank * 4);
        $odReductionPct = min(55, $odReductionPct);

        $addictionReduction = ($has('pure_synthesis') ? 1 : 0)
            + ($has('bio_synthetic') ? 1 : 0)
            + ($originId === 'street_chemist' ? 1 : 0)
            + ($chemistRank >= 2 ? 1 : 0);

        $medHealBonusPct = ($has('field_triage') ? 15 : 0)
            + ($has('adrenal_surge') ? 5 : 0)
            + ($has('bio_synthetic') ? 15 : 0)
            + ($originId === 'street_chemist' ? 10 : 0)
            + ($chemistRank * 5);
        $medHealBonusPct = min(55, $medHealBonusPct);

        $reviveEnergyReduction = ($has('field_triage') ? 2 : 0)
            + ($has('bio_synthetic') ? 3 : 0);

        // 4) Warlord Enforcer + cartel_bruiser + enforcer crew
        $combatDamagePct = ($has('iron_knuckles') ? 4 : 0)
            + ($has('arterial_strike') ? 6 : 0)
            + ($has('blood_frenzy') ? 4 : 0)
            + ($has('executioner') ? 6 : 0)
            + ($originId === 'cartel_bruiser' ? 10 : 0)
            + ($enforcerRank * 4);
        $combatDamagePct = min(50, $combatDamagePct);

        $combatAccuracyBps = ($has('iron_knuckles') ? 150 : 0)
            + ($has('hollow_point_drill') ? 150 : 0)
            + ($has('arterial_strike') ? 250 : 0)
            + ($has('executioner') ? 250 : 0)
            + ($originId === 'cartel_bruiser' ? 200 : 0)
            + ($enforcerRank * 100);

        $armorMitigationBonus = ($has('kevlar_weave') ? 0.06 : 0.0)
            + ($has('executioner') ? 0.04 : 0.0)
            + ($originId === 'cartel_bruiser' ? 0.03 : 0.0)
            + ($enforcerRank * 0.01);
        $armorMitigationBonus = min(0.18, round($armorMitigationBonus, 4));

        $mugPlunderPct = ($has('hollow_point_drill') ? 4 : 0)
            + ($has('blood_frenzy') ? 4 : 0)
            + ($has('executioner') ? 7 : 0)
            + ($originId === 'cartel_bruiser' ? 5 : 0)
            + ($enforcerRank * 2);
        $mugPlunderPct = min(35, $mugPlunderPct);

        return [
            'unlockedNodeIds' => array_keys($nodes),
            'originId' => $originId,
            'crewRanks' => [
                'lookout' => $lookoutRank,
                'wheelman' => $wheelmanRank,
                'chemist' => $chemistRank,
                'enforcer' => $enforcerRank,
                'consigliere' => $consigliereRank,
            ],
            'crimeSuccessPct' => $crimeSuccessPct,
            'crimeSuccessBps' => $crimeSuccessPct * 100,
            'crimeUniquePct' => $crimeUniquePct,
            'crimeUniqueBps' => $crimeUniquePct * 100,
            'crimeCashPct' => $crimeCashPct,
            'stealthPct' => $stealthPct,
            'nemesisHeatTaxPct' => $nemesisHeatTaxPct,
            'bankAprBonusPct' => $bankAprBonusPct,
            'stockFeeReductionPct' => $stockFeeReductionPct,
            'vaultCapBonusPct' => $vaultCapBonusPct,
            'jobPayBonusPct' => $jobPayBonusPct,
            'mogulLuggageBonus' => $mogulLuggageBonus,
            'flightTimeReductionPct' => $flightTimeReductionPct,
            'odReductionPct' => $odReductionPct,
            'addictionReduction' => $addictionReduction,
            'medHealBonusPct' => $medHealBonusPct,
            'reviveEnergyReduction' => $reviveEnergyReduction,
            'combatDamagePct' => $combatDamagePct,
            'combatAccuracyBps' => $combatAccuracyBps,
            'armorMitigationBonus' => $armorMitigationBonus,
            'mugPlunderPct' => $mugPlunderPct,
        ];
    }

    private function resolveActingPlayer(?Closure $cashFn, ?array $player = null): ?array
    {
        if (is_array($player) && isset($player['level'])) {
            return $player;
        }
        if ($cashFn !== null) {
            try {
                $vars = (new \ReflectionFunction($cashFn))->getStaticVariables();
                $pid = $vars['playerId'] ?? null;
                if (is_string($pid) && $pid !== '') {
                    return $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $pid]);
                }
            } catch (\Throwable) {
                return null;
            }
        }
        return null;
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

        $mods = self::extractLiveModifiers($state, $nowMs);
        $baseOdBps = !empty($state['eduDone']['chem']) ? (int) round($cfg['odBps'] * 0.75) : (int) $cfg['odBps'];
        $odBps = $mods['odReductionPct'] > 0
            ? max(1, (int) round($baseOdBps * (1.0 - ($mods['odReductionPct'] / 100.0))))
            : $baseOdBps;
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
            $odAddictGain = $mods['addictionReduction'] > 0 ? max(2, 5 - (int) $mods['addictionReduction']) : 5;
            $addiction = min(100, (int) $state['addiction'] + $odAddictGain);
            $state['addiction'] = $addiction;
            $state['cooldowns']['addiction'] = $addiction;
            return [
                'type' => 'drug.use',
                'drugId' => $drugId,
                'overdosed' => true,
                'effectiveOdBps' => $odBps,
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

        $lifeHealAmount = $cfg['life'] > 0
            ? (int) round($cfg['life'] * (1.0 + ($mods['medHealBonusPct'] / 100.0)))
            : 0;
        $newEnergy = $cfg['energy'] > 0 ? min(1000, (int) $player['energy'] + $cfg['energy']) : (int) $player['energy'];
        $newNerve = $cfg['nerve'] > 0 ? min((int) $player['max_nerve'] + 50, (int) $player['nerve'] + $cfg['nerve']) : (int) $player['nerve'];
        $newLife = $lifeHealAmount > 0 ? min((int) $player['max_life'] + 200, (int) $player['life'] + $lifeHealAmount) : (int) $player['life'];
        $newHappy = $cfg['doublesHappy']
            ? min(99999, max((int) $player['happy'] * 2, (int) $player['happy'] + 500))
            : ($cfg['happy'] > 0 ? min(99999, (int) $player['happy'] + $cfg['happy']) : (int) $player['happy']);

        $this->database->execute(
            'UPDATE players SET energy = :e, nerve = :n, life = :l, happy = :h WHERE id = :id',
            ['e' => $newEnergy, 'n' => $newNerve, 'l' => $newLife, 'h' => $newHappy, 'id' => $playerId],
        );
        $baseAddiction = (int) $cfg['addiction'];
        if ($mods['addictionReduction'] > 0) {
            $minFloor = $baseAddiction > 1 && (int) $mods['addictionReduction'] < 3 ? 1 : 0;
            $addictGain = max($minFloor, $baseAddiction - (int) $mods['addictionReduction']);
        } else {
            $addictGain = $baseAddiction;
        }
        $addiction = min(100, (int) $state['addiction'] + $addictGain);
        $state['addiction'] = $addiction;
        $state['cooldowns']['addiction'] = $addiction;

        return [
            'type' => 'drug.use',
            'drugId' => $drugId,
            'overdosed' => false,
            'effectiveOdBps' => $odBps,
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

        $mods = self::extractLiveModifiers($state, $nowMs);
        $baseOdBps = !empty($state['eduDone']['chem']) ? 260 : 350; // 3.5% base OD risk
        $odBps = $mods['odReductionPct'] > 0
            ? max(1, (int) round($baseOdBps * (1.0 - ($mods['odReductionPct'] / 100.0))))
            : $baseOdBps;
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
            $odAddictGain = $mods['addictionReduction'] > 0 ? max(2, 5 - (int) $mods['addictionReduction']) : 5;
            $addiction = min(100, (int) $state['addiction'] + $odAddictGain);
            $state['addiction'] = $addiction;
            $state['cooldowns']['addiction'] = $addiction;
            return [
                'type' => 'torn.happyJump',
                'source' => $source,
                'overdosed' => true,
                'effectiveOdBps' => $odBps,
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
        $hjAddictGain = $mods['addictionReduction'] > 0 ? max(1, 2 - (int) $mods['addictionReduction']) : 2;
        $addiction = min(100, (int) $state['addiction'] + $hjAddictGain);
        $state['addiction'] = $addiction;
        $state['cooldowns']['addiction'] = $addiction;

        return [
            'type' => 'torn.happyJump',
            'source' => $source,
            'overdosed' => false,
            'effectiveOdBps' => $odBps,
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
                'sallys' => ['nerve' => 4, 'cash' => 1650, 'maxSkillCash' => 5600, 'xp' => 9, 'playerXp' => 28, 'diffBps' => 200],
                'bits' => ['nerve' => 4, 'cash' => 1850, 'maxSkillCash' => 6200, 'xp' => 10, 'playerXp' => 30, 'diffBps' => 250],
                'super' => ['nerve' => 4, 'cash' => 2200, 'maxSkillCash' => 7200, 'xp' => 11, 'playerXp' => 32, 'diffBps' => 450],
                'superstore' => ['nerve' => 4, 'cash' => 2200, 'maxSkillCash' => 7200, 'xp' => 11, 'playerXp' => 32, 'diffBps' => 450],
                'clothing' => ['nerve' => 5, 'cash' => 2600, 'maxSkillCash' => 8400, 'xp' => 13, 'playerXp' => 36, 'diffBps' => 650],
                'cyber' => ['nerve' => 5, 'cash' => 3200, 'maxSkillCash' => 10200, 'xp' => 15, 'playerXp' => 40, 'diffBps' => 850],
                'bigals' => ['nerve' => 6, 'cash' => 4500, 'maxSkillCash' => 14500, 'xp' => 20, 'playerXp' => 48, 'diffBps' => 1200],
            ];
            $sub = $shopMap[$id] ?? $shopMap['sallys'];
            $cfg = [
                ...self::CRIMES_2['4'],
                'nerve' => $sub['nerve'],
                'cash' => $sub['cash'],
                'maxSkillCash' => $sub['maxSkillCash'],
                'xp' => $sub['xp'],
                'playerXp' => $sub['playerXp'],
                'diffBps' => $sub['diffBps'],
            ];
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
            $locBase = ['fountain' => 420, 'trash' => 450, 'beach' => 490, 'junkyard' => 540, 'cemetery' => 620, 'subway' => 720];
            $locMax  = ['fountain' => 2400, 'trash' => 2550, 'beach' => 2680, 'junkyard' => 2850, 'cemetery' => 3100, 'subway' => 3450];
            $base = $locBase[$id] ?? 450;
            $maxC = $locMax[$id] ?? 2550;
            $modPct = 65;
            foreach (self::searchForCashModifiers($unixSec) as $mRow) {
                if ($mRow['id'] === $id) {
                    $modPct = (int) $mRow['percentage'];
                    break;
                }
            }
            $extraSuccessBps += ($modPct - 55) * 25;
            $cfg = [
                ...self::CRIMES_2['1'],
                'cash' => max(300, (int) round($base * ($modPct / 65.0))),
                'maxSkillCash' => max(1800, (int) round($maxC * ($modPct / 65.0))),
            ];
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

        $playerLevel = max(1, (int) ($player['level'] ?? 1));
        $currentCrimeXp = max(0, (int) ($state['crimeXp'] ?? 96));
        self::assertCrime2Unlocked($crimeId, $playerLevel, $currentCrimeXp);

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
        $mods = self::extractLiveModifiers($state, $nowMs);

        $enhancerId = $cfg['enhancerId'];
        $hasEnhancer = (int) ($state['inv'][$enhancerId] ?? 0) > 0;
        $meritCrimeRank = max((int) ($state['meritTree']['crime'] ?? 0), (int) ($state['meritTree']['crime_xp'] ?? 0));
        $csBonusBps = (!empty($state['eduDone']['cs']) && in_array($cfg['key'], ['card_skimming', 'cracking'], true)) ? 1000 : 0;
        $crimBonusBps = !empty($state['eduDone']['crim']) ? 800 : 0;

        // Enhancer grants +12% (+1200 bps) success & unique boost; Shadow/Origin/Lookout boost success & unique odds
        $enhancerBps = $hasEnhancer ? 1200 : 0;
        $shadowSuccessBps = (int) $mods['crimeSuccessBps'];
        $shadowUniqueBps = (int) $mods['crimeUniqueBps'];

        $successCap = max(
            2500,
            min(
                9600,
                6200 + $skill * 28 + $enhancerBps + $meritCrimeRank * 300 + $csBonusBps + $extraSuccessBps + $shadowSuccessBps - (int) $cfg['diffBps'],
            ),
        );
        $uniqueCap = max(400, min(3800, 700 + $skill * 12 + ($hasEnhancer ? 1200 : 0) + $crimBonusBps + $shadowUniqueBps));
        $uniqueCap = min($uniqueCap, $successCap - 500);
        $critChanceBps = max(250, 1200 - $skill * 8 - ($hasEnhancer ? 300 : 0) - intdiv($shadowSuccessBps, 4));
        $failCap = min(9750, max($successCap, 10000 - $critChanceBps));

        $minBaseCash = (int) $cfg['cash'];
        $maxSkillCash = max($minBaseCash, (int) ($cfg['maxSkillCash'] ?? ($minBaseCash * 3)));
        $scaledBaseCash = (int) round($minBaseCash + (($maxSkillCash - $minBaseCash) * ($skill / 100.0)));
        $crimeCashMult = 1.0 + ($mods['crimeCashPct'] / 100.0);

        $roll = $this->roll(1, 10000);
        $cashDelta = 0;
        $grossCash = 0;
        $nemesisSkimmed = 0;
        $xpEarned = 0;
        $playerXpEarned = 0;
        $levelUp = null;
        $lootGranted = null;
        $penaltyApplied = null;

        if ($roll <= $uniqueCap) {
            $tier = 'UNIQUE_OUTCOME';
            $grossCash = max(450, (int) round($scaledBaseCash * 2.2 * $crimeCashMult));
            $xpEarned = (int) $cfg['xp'] * 2;
            $playerXpEarned = (int) ($cfg['playerXp'] ?? 18) * 2;
            $newSkill = min(100, $skill + 3);
            $lootGranted = $cfg['loot'];
            $state['inv'][$lootGranted] = (int) ($state['inv'][$lootGranted] ?? 0) + 1;
            $this->ledger->record($playerId, 'item:' . $lootGranted, 1, (int) $state['inv'][$lootGranted], 'crime2.unique_loot', $correlationId);
            $state['ctr']['crimes'] = (int) ($state['ctr']['crimes'] ?? 0) + 1;
        } elseif ($roll <= $successCap) {
            $tier = 'SUCCESS';
            $grossCash = max(250, (int) round($scaledBaseCash * $crimeCashMult));
            $xpEarned = (int) $cfg['xp'];
            $playerXpEarned = (int) ($cfg['playerXp'] ?? 18);
            $newSkill = min(100, $skill + 2);
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

        if ($grossCash > 0) {
            if ((int) $mods['nemesisHeatTaxPct'] > 0) {
                $nemesisSkimmed = max(1, (int) round($grossCash * ((int) $mods['nemesisHeatTaxPct'] / 100.0)));
                $nemesisSkimmed = min($grossCash - 1, $nemesisSkimmed);
            }
            $cashDelta = max(1, $grossCash - $nemesisSkimmed);
            $cashFn($cashDelta, $action . ':' . $cfg['key'], $correlationId);
        }

        if ($playerXpEarned > 0) {
            $this->database->execute(
                'UPDATE players SET xp = xp + :xp WHERE id = :id',
                ['xp' => $playerXpEarned, 'id' => $playerId],
            );
            $levelUp = (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);
            if ($levelUp !== null) {
                $freshProgRow = $this->database->fetchOne(
                    'SELECT state_json FROM player_progression WHERE player_id = :id',
                    ['id' => $playerId],
                );
                if ($freshProgRow !== null) {
                    $freshProgState = json_decode((string) $freshProgRow['state_json'], true, 512, JSON_THROW_ON_ERROR);
                    if (isset($freshProgState['merits'])) {
                        $state['merits'] = $freshProgState['merits'];
                    }
                    if (isset($freshProgState['rpg'])) {
                        $state['rpg'] = $freshProgState['rpg'];
                    }
                }
            }
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
            'grossCash' => $grossCash,
            'nemesisSkimmed' => $nemesisSkimmed,
            'nemesisHeatTaxPct' => (int) $mods['nemesisHeatTaxPct'],
            'playerXpEarned' => $playerXpEarned,
            'skill' => $newSkill,
            'enhancer' => $cfg['enhancer'],
            'enhancerActive' => $hasEnhancer,
            'lootItem' => $lootGranted,
            'penalty' => $penaltyApplied,
        ];

        return [
            'cashDelta' => $cashDelta,
            'grossCash' => $grossCash,
            'nemesisSkimmed' => $nemesisSkimmed,
            'nemesisHeatTaxPct' => (int) $mods['nemesisHeatTaxPct'],
            'nerveSpent' => $nerveCost,
            'xpEarned' => $xpEarned,
            'playerXpEarned' => $playerXpEarned,
            'levelUp' => $levelUp,
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
        self::assertLevelUnlocked((int) ($player['level'] ?? 1), 10, 'Bank Term CDs');

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

        $mods = self::extractLiveModifiers($state, $nowMs);
        $meritBankRank = max((int) ($state['meritTree']['bank_interest'] ?? 0), (int) ($state['meritTree']['bank'] ?? 0));
        $econMult = !empty($state['eduDone']['econ']) ? 1.05 : 1.0;
        $meritMult = 1.0 + 0.05 * $meritBankRank;
        $mogulAprMult = 1.0 + ($mods['bankAprBonusPct'] / 100.0);
        $effectiveAprBps = (int) round($termCfg['aprBps'] * $meritMult * $econMult * $mogulAprMult);
        $interest = max(1, (int) round($principal * ($termCfg['yieldBps'] / 10000.0) * $meritMult * $econMult * $mogulAprMult));
        $payout = $principal + $interest;

        $cd = [
            'term' => $term,
            'principal' => $principal,
            'interest' => $interest,
            'aprBps' => $effectiveAprBps,
            'mogulAprBonusPct' => (int) $mods['bankAprBonusPct'],
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

    public function buyStock(string $id, array &$state, int $nowMs, Closure $cashFn, string $correlationId, ?array $player = null): array
    {
        $parts = explode(':', $id, 2);
        $ticker = strtoupper(trim($parts[0] ?? ''));
        if (!isset(self::STOCKS[$ticker]) || !isset($parts[1])) {
            throw new InvalidArgumentException('Stock buy format must be TICKER:SHARES (e.g. SYM:100).');
        }
        $quote = self::stockQuote($ticker, intdiv($nowMs, 1000));
        $maxSafeByPrice = max(1, intdiv(min(2_000_000_000, intdiv(PHP_INT_MAX, 2)), max(1, $quote['price'])));
        $shares = self::parsePositiveInt($parts[1], 1, min(10_000_000, $maxSafeByPrice), 'share quantity');

        $actingPlayer = $this->resolveActingPlayer($cashFn, $player);
        if ($actingPlayer !== null) {
            self::assertLevelUnlocked((int) ($actingPlayer['level'] ?? 1), 12, 'Stock Exchange');
        }

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

        $mods = self::extractLiveModifiers($state, $nowMs);
        $feeRate = 0.01 * (1.0 - ($mods['stockFeeReductionPct'] / 100.0)); // 1.0% down to 0.5%
        $quote = self::stockQuote($ticker, intdiv($nowMs, 1000));
        $gross = $shares * $quote['price'];
        $fee = max(1, (int) round($gross * $feeRate));
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
            'feeRateBps' => (int) round($feeRate * 10000),
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
        $cap = !$hasGuard ? $base : ($base === 0 ? 500_000 : (int) round($base * 1.25));
        if ($cap <= 0) {
            return 0;
        }
        $mods = self::extractLiveModifiers($state);
        if ((int) $mods['vaultCapBonusPct'] <= 0) {
            return $cap;
        }
        return (int) round($cap * (1.0 + ((int) $mods['vaultCapBonusPct'] / 100.0)));
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

        $mods = self::extractLiveModifiers($state, $nowMs);
        $healAmount = (int) round(300 * (1.0 + ($mods['medHealBonusPct'] / 100.0)));
        $newLife = min((int) $player['max_life'], (int) $player['life'] + $healAmount);
        $remHosp = max(0, (int) ($state['hospUntil'] ?? 0) - $nowMs);
        $hospReduced = min($remHosp, 3_600_000);
        if ($hospReduced > 0) {
            $state['hospUntil'] = $hospReduced >= $remHosp ? 0 : (int) $state['hospUntil'] - $hospReduced;
        }
        $this->database->execute('UPDATE players SET life = :life WHERE id = :id', ['life' => $newLife, 'id' => $playerId]);

        return [
            'mode' => $mode ?: 'use',
            'healAmount' => $healAmount,
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
            $newNerve = min((int) $player['nerve'], $newMaxNerve);
            $newMaxLife = max(100, (int) $player['max_life'] - $lifeApplied);
            $newLife = min((int) $player['life'], $newMaxLife);
            $this->database->execute(
                'UPDATE players SET max_nerve = :mn, nerve = :n, max_life = :ml, life = :l WHERE id = :id',
                ['mn' => $newMaxNerve, 'n' => $newNerve, 'ml' => $newMaxLife, 'l' => $newLife, 'id' => $playerId],
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

        $playerLevel = max(1, (int) ($player['level'] ?? 1));
        $crimeXp = max(0, (int) ($state['crimeXp'] ?? 96));
        $levelGates = self::buildLevelGates($playerLevel);
        $livePerks = self::extractLiveModifiers($state, $nowMs);

        $crimes2Out = [];
        foreach (self::CRIMES_2 as $cid => $cfg) {
            $cidStr = (string) $cid;
            $sKey = 'crime2_' . $cfg['key'];
            $enhId = $cfg['enhancerId'];
            $unlocked = self::isCrime2Unlocked($cidStr, $playerLevel, $crimeXp);
            $reqLevel = (int) ($cfg['reqLevel'] ?? 1);
            $reqCrimeXp = (int) ($cfg['reqCrimeXp'] ?? 0);
            $crimes2Out[] = [
                'id' => $cidStr,
                'key' => $cfg['key'],
                'name' => $cfg['name'],
                'nerve' => $cfg['nerve'],
                'baseCash' => $cfg['cash'],
                'maxSkillCash' => $cfg['maxSkillCash'],
                'xp' => $cfg['xp'],
                'playerXp' => $cfg['playerXp'],
                'requiredLevel' => $reqLevel,
                'requiredCrimeXp' => $reqCrimeXp,
                'unlocked' => $unlocked,
                'lockReason' => $unlocked
                    ? null
                    : "Locked: Reach Level {$reqLevel} (or {$reqCrimeXp} Crime XP) to unlock {$cfg['name']} (Current: Lv {$playerLevel}, {$crimeXp} Crime XP).",
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
            'version' => 'ZONE-TORN-151',
            'harvestedEndpoints' => 57,
            'levelGates' => $levelGates,
            'livePerks' => $livePerks,
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

    /**
     * Enriches a list of player directory / roster entries with avatarUrl, avatarDataUrl,
     * hasCustomAvatar, and avatarPresetId via a single batched IN (...) query.
     *
     * @param list<array<string, mixed>> $entries
     * @return list<array<string, mixed>>
     */
    public static function enrichPlayerProfileDirectory(Database $database, EventBus $events, array $entries): array
    {
        if ($entries === []) {
            return [];
        }
        $ids = [];
        foreach ($entries as $entry) {
            if (is_array($entry) && isset($entry['id']) && is_string($entry['id']) && $entry['id'] !== '') {
                $ids[] = $entry['id'];
            }
        }
        $avatarMap = (new PlayerAvatarService($database, $events))->batchSummaryForPlayers($ids);

        $out = [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $pid = (string) ($entry['id'] ?? '');
            $meta = $avatarMap[$pid] ?? null;
            $out[] = [
                ...$entry,
                'hasCustomAvatar' => (bool) ($meta['hasCustomAvatar'] ?? false),
                'avatarPresetId' => (string) ($meta['avatarPresetId'] ?? ''),
                'avatarUrl' => $meta['avatarUrl'] ?? null,
                'avatarDataUrl' => $meta['avatarDataUrl'] ?? null,
            ];
        }
        return $out;
    }

    /**
     * Enriches the full /api/v1/player-profile payload (profile + directory + players)
     * in a single batched IN (...) query on player_avatars.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public static function enrichPlayerProfilePayload(Database $database, EventBus $events, array $payload): array
    {
        $ids = [];
        foreach (['directory', 'players'] as $listKey) {
            if (is_array($payload[$listKey] ?? null)) {
                foreach ($payload[$listKey] as $entry) {
                    if (is_array($entry) && !empty($entry['id']) && is_string($entry['id'])) {
                        $ids[] = $entry['id'];
                    }
                }
            }
        }
        if (is_array($payload['profile'] ?? null) && !empty($payload['profile']['id']) && is_string($payload['profile']['id'])) {
            $ids[] = $payload['profile']['id'];
        }

        $avatarService = new PlayerAvatarService($database, $events);
        $avatarMap = $avatarService->batchSummaryForPlayers($ids);

        $applyEntry = static function (array $entry) use ($avatarMap): array {
            $pid = (string) ($entry['id'] ?? '');
            $meta = $avatarMap[$pid] ?? null;
            return [
                ...$entry,
                'hasCustomAvatar' => (bool) ($meta['hasCustomAvatar'] ?? false),
                'avatarPresetId' => (string) ($meta['avatarPresetId'] ?? ''),
                'avatarUrl' => $meta['avatarUrl'] ?? null,
                'avatarDataUrl' => $meta['avatarDataUrl'] ?? null,
            ];
        };

        if (is_array($payload['directory'] ?? null)) {
            $payload['directory'] = array_values(array_map(
                static fn (mixed $item): mixed => is_array($item) ? $applyEntry($item) : $item,
                $payload['directory'],
            ));
        }
        if (is_array($payload['players'] ?? null)) {
            $payload['players'] = array_values(array_map(
                static fn (mixed $item): mixed => is_array($item) ? $applyEntry($item) : $item,
                $payload['players'],
            ));
        }
        if (is_array($payload['profile'] ?? null)) {
            $prof = $applyEntry($payload['profile']);
            $profId = (string) ($prof['id'] ?? '');
            if ($profId !== '' && !empty($prof['hasCustomAvatar'])) {
                $fullState = $avatarService->state($profId);
                if (!empty($fullState['dataUrl'])) {
                    $prof['avatarDataUrl'] = $fullState['dataUrl'];
                }
            }
            $payload['profile'] = $prof;
        }

        return $payload;
    }

    /**
     * @param list<array<string, mixed>> $entries
     * @return list<array<string, mixed>>
     */
    public function playerProfileDirectory(array $entries): array
    {
        return self::enrichPlayerProfileDirectory($this->database, $this->events, $entries);
    }

    /**
     * @return array<string, mixed>
     */
    public function playerProfile(string $viewerId, ?string $targetId = null, ?string $query = null): array
    {
        $payload = (new SyndicateSocialService($this->database, $this->events))->playerProfile($viewerId, $targetId, $query);
        return self::enrichPlayerProfilePayload($this->database, $this->events, $payload);
    }
}

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v157 — Track 10: 9-Slot Paperdoll Set Synergies, Roguelike Tactical Perk Deck & Operative Character Card
 * =============================================================================================================
 * Canonical Namespace: `Zone\Engine\Core\Game\LoadoutSynergyService`
 * Alias Registered:    `Zone\Core\Game\LoadoutSynergyService`
 *
 * @integrator Route Wiring Guide (`engine/router.php` + `GameEngine.php`):
 * -----------------------------------------------------------------------------------------
 * Constructor:
 *   `$synergies = new LoadoutSynergyService($this->database, $this->events);`
 *
 * Unified Router Dispatch:
 *   1. `GET /api/v1/synergies` (or `synergy.state`):
 *      `$synergies->snapshot($playerId)`
 *   2. `POST /api/v1/synergies/action` (`synergy.equip_card`, `synergy.unequip_card`, `synergy.set_deck`, `synergy.equip_slot`):
 *      `$synergies->act($playerId, (string) ($body['action'] ?? ''), $body)`
 *
 * Direct Public Domain API Methods:
 *   - `ensureSchema(): void`
 *   - `snapshot(int|string $playerId): array`
 *   - `act(int|string $playerId, string $action, array $payload = []): array`
 *   - `evaluateSetSynergies(array $loadout, array $progState = []): array`
 *   - `equipPerkCard(int|string $playerId, string $cardId, ?int $slotIndex = null): array`
 *   - `unequipPerkCard(int|string $playerId, int|string $slotOrCard): array`
 *   - `setPerkDeck(int|string $playerId, array $cardIds): array`
 *   - `getCombatAndEconomyModifiers(int|string $playerId): array`
 *
 * Database Dual-Compatibility (PostgreSQL 16 + SQLite 3):
 *   - Idempotent `player_loadout_synergies` DDL on construction.
 *   - Zero 2-argument SQLite scalar `MAX(a,b)` / `MIN(a,b)` functions (`CASE WHEN` only).
 *   - Strictly unique named PDO placeholders per SQL statement.
 */
final class LoadoutSynergyService
{
    public const DECK_SLOT_COUNT = 3;
    public const BASE_ENERGY_CAP = 5;
    public const MAX_ENERGY_CAP = 6;

    /**
     * 4 Syndicate Gear Set Archetypes evaluated across the 9-Slot Paperdoll.
     *
     * @var array<string, array<string, mixed>>
     */
    public const SET_ARCHETYPES = [
        'ghost_operative' => [
            'id' => 'ghost_operative',
            'nameEn' => 'Ghost Operative',
            'nameAr' => 'شبح العمليات',
            'element' => 'Shadow',
            'role' => 'Infiltrator',
            'accentTone' => 'sage',
            'crestAssetId' => 'crest_ghost_operative',
            'focusEn' => 'Stealth & Crit',
            'focusAr' => 'التخفي والضربات الحرجة',
            'bonus2En' => '2pc: +10% Stealth Window · +6% Crit · -4 dB Noise',
            'bonus2Ar' => 'قطعتان: +10% نافذة التخفي · +6% حرج · -4 dB ضوضاء',
            'bonus4En' => '4pc: +22% Stealth Window · +15% Crit · -10 dB Noise',
            'bonus4Ar' => '٤ قطع: +22% نافذة التخفي · +15% حرج · -10 dB ضوضاء',
            'itemsBySlot' => [
                'primary' => ['sniper', 'smg', 'bullpup_1', 'bullpup_2', 'bullpup_3', 'bullpup_4'],
                'secondary' => ['pistol_t', 'pistol'],
                'melee' => ['knife', 'cut_throat_razor'],
                'temporary' => ['smoke_grenade'],
                'head' => ['paint_mask'],
                'hands' => ['armor'],
            ],
            'tier2Bonuses' => ['stealthPct' => 10, 'critChancePct' => 6, 'noiseReductionDb' => 4],
            'tier4Bonuses' => ['stealthPct' => 22, 'critChancePct' => 15, 'noiseReductionDb' => 10],
        ],
        'iron_enforcer' => [
            'id' => 'iron_enforcer',
            'nameEn' => 'Iron Enforcer',
            'nameAr' => 'منفّذ الحديد',
            'element' => 'Steel',
            'role' => 'Vanguard',
            'accentTone' => 'crimson',
            'crestAssetId' => 'crest_iron_enforcer',
            'focusEn' => 'Armor & Melee',
            'focusAr' => 'الدروع والاشتباك',
            'bonus2En' => '2pc: +8% Armor Mitigation · +12% Melee Damage',
            'bonus2Ar' => 'قطعتان: +8% امتصاص الدرع · +12% ضرر الاشتباك',
            'bonus4En' => '4pc: +18% Armor Mitigation · +28% Melee Damage · +8% Riposte',
            'bonus4Ar' => '٤ قطع: +18% امتصاص الدرع · +28% ضرر الاشتباك · +8% رد مرتد',
            'itemsBySlot' => [
                'primary' => ['shotgun', 'assaultrifle_1', 'assaultrifle_2', 'assaultrifle_3', 'assaultrifle_4'],
                'secondary' => ['sawedoff'],
                'melee' => ['bat'],
                'temporary' => ['flash_grenade'],
                'head' => ['tac_helmet'],
                'body' => ['tac_plate'],
                'hands' => ['tac_gloves'],
                'legs' => ['tac_greaves'],
                'feet' => ['tac_boots'],
            ],
            'tier2Bonuses' => ['armorBonusPct' => 8, 'meleeDamagePct' => 12],
            'tier4Bonuses' => ['armorBonusPct' => 18, 'meleeDamagePct' => 28, 'ripostePct' => 8],
        ],
        'cartel_sovereign' => [
            'id' => 'cartel_sovereign',
            'nameEn' => 'Cartel Sovereign',
            'nameAr' => 'سيّد الكارتل',
            'element' => 'Gold',
            'role' => 'Broker',
            'accentTone' => 'gold',
            'crestAssetId' => 'crest_cartel_sovereign',
            'focusEn' => 'Mug & Bazaar Yield',
            'focusAr' => 'عوائد النشل والبازار',
            'bonus2En' => '2pc: +12% Mug Yield · -10% Bazaar Fee',
            'bonus2Ar' => 'قطعتان: +12% غنائم النشل · -10% عمولة البازار',
            'bonus4En' => '4pc: +25% Mug Yield · -25% Bazaar Fee · +10% Plunder',
            'bonus4Ar' => '٤ قطع: +25% غنائم النشل · -25% عمولة البازار · +10% سلب',
            'itemsBySlot' => [
                'primary' => ['ak', 'assaultrifle2_1', 'assaultrifle2_2', 'assaultrifle2_3', 'assaultrifle2_4'],
                'secondary' => ['magnum', 'revolver'],
                'melee' => ['cut_throat_razor'],
                'body' => ['vest'],
                'legs' => ['vest'],
                'feet' => ['armor'],
            ],
            'tier2Bonuses' => ['mugYieldPct' => 12, 'bazaarFeeReductionPct' => 10],
            'tier4Bonuses' => ['mugYieldPct' => 25, 'bazaarFeeReductionPct' => 25, 'plunderPct' => 10],
        ],
        'chem_alchemist' => [
            'id' => 'chem_alchemist',
            'nameEn' => 'Chem Alchemist',
            'nameAr' => 'خيميائي المنشطات',
            'element' => 'Bio',
            'role' => 'Tactician',
            'accentTone' => 'blue',
            'crestAssetId' => 'crest_chem_alchemist',
            'focusEn' => 'Booster & Med Mastery',
            'focusAr' => 'إتقان المنشطات والإسعاف',
            'bonus2En' => '2pc: +15% Med Heal · +12% Booster Potency',
            'bonus2Ar' => 'قطعتان: +15% شفاء طبي · +12% فعالية المنشطات',
            'bonus4En' => '4pc: +32% Med Heal · +25% Booster Potency · -25% OD Risk',
            'bonus4Ar' => '٤ قطع: +32% شفاء طبي · +25% فعالية المنشطات · -25% خطر الجرعة',
            'itemsBySlot' => [
                'temporary' => ['epinephrine', 'smoke_grenade'],
                'head' => ['paint_mask'],
                'body' => ['armor'],
                'hands' => ['tac_gloves'],
                'legs' => ['armor'],
            ],
            'stockCatalogItems' => ['medkit', 'smallkit', 'bloodbag', 'morphine', 'epinephrine', 'drink', 'energydrink', 'xanax', 'vicodin', 'cannabis'],
            'tier2Bonuses' => ['medHealPct' => 15, 'boosterPotencyPct' => 12],
            'tier4Bonuses' => ['medHealPct' => 32, 'boosterPotencyPct' => 25, 'overdoseReductionPct' => 25],
        ],
    ];

    /**
     * 6 Roguelike Tactical Perk Cards (`deckbuilder-roguelike` + `traits` schema).
     *
     * @var array<string, array<string, mixed>>
     */
    public const PERK_CARDS = [
        'double_tap' => [
            'id' => 'double_tap',
            'nameEn' => 'Double Tap',
            'nameAr' => 'ضربة مزدوجة',
            'energyCost' => 2,
            'cardType' => 'Attack',
            'rarity' => 'rare',
            'archetype' => 'ghost_operative',
            'synergyTag' => 'crit_chain',
            'summaryEn' => '+14% Weapon Damage · +12% Critical Hit Chance',
            'summaryAr' => '+14% ضرر السلاح · +12% فرصة الضربة الحرجة',
            'modifiers' => [
                'weaponDamagePct' => 14,
                'critChancePct' => 12,
            ],
            'trait' => [
                'name' => 'double_tap',
                'description' => 'Increases primary and secondary weapon burst damage by 14%. Raises critical strike confirmation by 12% during tactical exchanges. Chains with ambush stealth windows to amplify opening burst.',
                'quirk' => 'Increases primary and secondary weapon burst damage by 14%. Raises critical strike confirmation by 12% during tactical exchanges. Chains with ambush stealth windows to amplify opening burst.',
                'attributes' => [['attribute' => 'speed', 'modifier' => 2]],
                'skills' => [['skill' => 'marksmanship', 'modifier' => 12]],
                'resources' => [['resource' => 'energy', 'modifier' => -2]],
                'startingItems' => [],
                'abilities' => ['Double Tap Volley'],
                'unlockedBy' => [],
                'excludedBy' => [],
            ],
        ],
        'smoke_vanish' => [
            'id' => 'smoke_vanish',
            'nameEn' => 'Smoke Vanish',
            'nameAr' => 'تلاشي الدخان',
            'energyCost' => 1,
            'cardType' => 'Skill',
            'rarity' => 'uncommon',
            'archetype' => 'ghost_operative',
            'synergyTag' => 'stealth_evade',
            'summaryEn' => '+16% Stealth · +12% Evasion · -6 dB Noise',
            'summaryAr' => '+16% تخفٍ · +12% مراوغة · -6 dB ضوضاء',
            'modifiers' => [
                'stealthPct' => 16,
                'evasionPct' => 12,
                'noiseReductionDb' => 6,
            ],
            'trait' => [
                'name' => 'smoke_vanish',
                'description' => 'Extends stealth blind-spot infiltration tolerance by 16%. Grants 12% incoming fire evasion while moving between cover. Dampens acoustic breach signatures by 6 decibels.',
                'quirk' => 'Extends stealth blind-spot infiltration tolerance by 16%. Grants 12% incoming fire evasion while moving between cover. Dampens acoustic breach signatures by 6 decibels.',
                'attributes' => [['attribute' => 'dexterity', 'modifier' => 2]],
                'skills' => [['skill' => 'stealth', 'modifier' => 16]],
                'resources' => [['resource' => 'energy', 'modifier' => -1]],
                'startingItems' => [],
                'abilities' => ['Smoke Veil'],
                'unlockedBy' => [],
                'excludedBy' => [],
            ],
        ],
        'adrenaline_surge' => [
            'id' => 'adrenaline_surge',
            'nameEn' => 'Adrenaline Surge',
            'nameAr' => 'اندفاع الأدرينالين',
            'energyCost' => 2,
            'cardType' => 'Power',
            'rarity' => 'rare',
            'archetype' => 'chem_alchemist',
            'synergyTag' => 'tempo_boost',
            'summaryEn' => '+18% Booster Potency · +15% Med Heal · +8% Tempo',
            'summaryAr' => '+18% فعالية المنشطات · +15% شفاء طبي · +8% إيقاع',
            'modifiers' => [
                'boosterPotencyPct' => 18,
                'medHealPct' => 15,
                'tempoPct' => 8,
            ],
            'trait' => [
                'name' => 'adrenaline_surge',
                'description' => 'Amplifies all booster item yield by 18% on activation. Enhances trauma medical kit restoration by 15% per dose. Sustains tactical combat tempo by +8% across consecutive turns.',
                'quirk' => 'Amplifies all booster item yield by 18% on activation. Enhances trauma medical kit restoration by 15% per dose. Sustains tactical combat tempo by +8% across consecutive turns.',
                'attributes' => [['attribute' => 'strength', 'modifier' => 1], ['attribute' => 'speed', 'modifier' => 1]],
                'skills' => [['skill' => 'triage', 'modifier' => 15]],
                'resources' => [['resource' => 'energy', 'modifier' => -2]],
                'startingItems' => [],
                'abilities' => ['Adrenaline Overclock'],
                'unlockedBy' => [],
                'excludedBy' => [],
            ],
        ],
        'kevlar_ricochet' => [
            'id' => 'kevlar_ricochet',
            'nameEn' => 'Kevlar Ricochet',
            'nameAr' => 'ارتداد الكيفلر',
            'energyCost' => 2,
            'cardType' => 'Skill',
            'rarity' => 'uncommon',
            'archetype' => 'iron_enforcer',
            'synergyTag' => 'armor_counter',
            'summaryEn' => '+10% Armor Mitigation · +15% Counter Riposte · +10% Melee',
            'summaryAr' => '+10% امتصاص الدرع · +15% صد مرتد · +10% اشتباك',
            'modifiers' => [
                'armorBonusPct' => 10,
                'ripostePct' => 15,
                'meleeDamagePct' => 10,
            ],
            'trait' => [
                'name' => 'kevlar_ricochet',
                'description' => 'Reinforces ballistic plate mitigation by 10% against incoming rounds. Reflects 15% counter-riposte damage when blocking close-quarters rushes. Adds 10% heavy impact damage to melee strikes.',
                'quirk' => 'Reinforces ballistic plate mitigation by 10% against incoming rounds. Reflects 15% counter-riposte damage when blocking close-quarters rushes. Adds 10% heavy impact damage to melee strikes.',
                'attributes' => [['attribute' => 'defense', 'modifier' => 2]],
                'skills' => [['skill' => 'fortitude', 'modifier' => 10]],
                'resources' => [['resource' => 'energy', 'modifier' => -2]],
                'startingItems' => [],
                'abilities' => ['Ballistic Deflect'],
                'unlockedBy' => [],
                'excludedBy' => [],
            ],
        ],
        'blood_money' => [
            'id' => 'blood_money',
            'nameEn' => 'Blood Money',
            'nameAr' => 'مال الدم',
            'energyCost' => 2,
            'cardType' => 'Power',
            'rarity' => 'rare',
            'archetype' => 'cartel_sovereign',
            'synergyTag' => 'yield_plunder',
            'summaryEn' => '+18% Mug Yield · +12% Plunder Cash',
            'summaryAr' => '+18% عائد النشل · +12% سلب نقدي',
            'modifiers' => [
                'mugYieldPct' => 18,
                'plunderPct' => 12,
            ],
            'trait' => [
                'name' => 'blood_money',
                'description' => 'Increases street mugging cash extraction by 18% upon victory. Adds 12% bonus plunder from defeated syndicate targets. Stacks multiplicatively with Cartel Sovereign armor sets.',
                'quirk' => 'Increases street mugging cash extraction by 18% upon victory. Adds 12% bonus plunder from defeated syndicate targets. Stacks multiplicatively with Cartel Sovereign armor sets.',
                'attributes' => [['attribute' => 'strength', 'modifier' => 2]],
                'skills' => [['skill' => 'extortion', 'modifier' => 18]],
                'resources' => [['resource' => 'energy', 'modifier' => -2]],
                'startingItems' => [],
                'abilities' => ['Cartel Tribute'],
                'unlockedBy' => [],
                'excludedBy' => [],
            ],
        ],
        'clean_getaway' => [
            'id' => 'clean_getaway',
            'nameEn' => 'Clean Getaway',
            'nameAr' => 'انسحاب نظيف',
            'energyCost' => 1,
            'cardType' => 'Skill',
            'rarity' => 'common',
            'archetype' => 'cartel_sovereign',
            'synergyTag' => 'escape_bazaar',
            'summaryEn' => '-12% Bazaar Fee · +10% Stealth · +16% Escape',
            'summaryAr' => '-12% عمولة البازار · +10% تخفٍ · +16% هروب',
            'modifiers' => [
                'bazaarFeeReductionPct' => 12,
                'stealthPct' => 10,
                'escapePct' => 16,
            ],
            'trait' => [
                'name' => 'clean_getaway',
                'description' => 'Reduces player bazaar brokerage fees by 12% through trusted courier routes. Improves post-heist escape probability by 16% across all districts. Adds 10% stealth clearance during exfiltration.',
                'quirk' => 'Reduces player bazaar brokerage fees by 12% through trusted courier routes. Improves post-heist escape probability by 16% across all districts. Adds 10% stealth clearance during exfiltration.',
                'attributes' => [['attribute' => 'dexterity', 'modifier' => 1], ['attribute' => 'speed', 'modifier' => 1]],
                'skills' => [['skill' => 'exfiltration', 'modifier' => 16]],
                'resources' => [['resource' => 'energy', 'modifier' => -1]],
                'startingItems' => [],
                'abilities' => ['Courier Exfil'],
                'unlockedBy' => [],
                'excludedBy' => [],
            ],
        ],
    ];

    /**
     * Cross-card deckbuilder synergy combos unlocked when specific pairs are equipped together.
     *
     * @var list<array<string, mixed>>
     */
    public const CARD_COMBOS = [
        [
            'id' => 'phantom_volley',
            'cards' => ['double_tap', 'smoke_vanish'],
            'nameEn' => 'Phantom Volley',
            'nameAr' => 'رشقة الشبح',
            'bonusEn' => '+10% Ambush Crit from Smoke',
            'bonusAr' => '+10% ضربة حرجة من الدخان',
            'bonuses' => ['critChancePct' => 10],
        ],
        [
            'id' => 'overclocked_burst',
            'cards' => ['double_tap', 'adrenaline_surge'],
            'nameEn' => 'Overclocked Burst',
            'nameAr' => 'انفجار محفّز',
            'bonusEn' => '+8% Weapon Damage · +6% Tempo',
            'bonusAr' => '+8% ضرر السلاح · +6% سرعة',
            'bonuses' => ['weaponDamagePct' => 8, 'tempoPct' => 6],
        ],
        [
            'id' => 'ghost_extraction',
            'cards' => ['smoke_vanish', 'clean_getaway'],
            'nameEn' => 'Ghost Extraction',
            'nameAr' => 'إجلاء الشبح',
            'bonusEn' => '+12% Escape · -4 dB Noise',
            'bonusAr' => '+12% هروب · -4 dB ضوضاء',
            'bonuses' => ['escapePct' => 12, 'noiseReductionDb' => 4],
        ],
        [
            'id' => 'stim_plated_reflex',
            'cards' => ['adrenaline_surge', 'kevlar_ricochet'],
            'nameEn' => 'Stim-Plated Reflex',
            'nameAr' => 'منعكس الدرع المحفز',
            'bonusEn' => '+6% Armor · +10% Med Heal',
            'bonusAr' => '+6% درع · +10% شفاء طبي',
            'bonuses' => ['armorBonusPct' => 6, 'medHealPct' => 10],
        ],
        [
            'id' => 'enforcer_toll',
            'cards' => ['kevlar_ricochet', 'blood_money'],
            'nameEn' => 'Enforcer Toll',
            'nameAr' => 'ضريبة المنفّذ',
            'bonusEn' => '+8% Riposte · +8% Mug Yield',
            'bonusAr' => '+8% صد مرتد · +8% عائد النشل',
            'bonuses' => ['ripostePct' => 8, 'mugYieldPct' => 8],
        ],
        [
            'id' => 'syndicate_skim',
            'cards' => ['blood_money', 'clean_getaway'],
            'nameEn' => 'Syndicate Skim',
            'nameAr' => 'اقتطاع النقابة',
            'bonusEn' => '-8% Bazaar Fee · +10% Plunder',
            'bonusAr' => '-8% عمولة البازار · +10% سلب',
            'bonuses' => ['bazaarFeeReductionPct' => 8, 'plunderPct' => 10],
        ],
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $clock = null,
    ) {
        $this->resources = new ResourceService($database);
        $this->ensureSchema();
    }

    /**
     * Idempotently ensures PostgreSQL 16 & SQLite 3 schema table (`player_loadout_synergies`).
     */
    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS player_loadout_synergies (
                player_id VARCHAR(64) PRIMARY KEY,
                deck_json TEXT NOT NULL,
                energy_cap INTEGER NOT NULL DEFAULT 5,
                energy_used INTEGER NOT NULL DEFAULT 0,
                active_archetype VARCHAR(48) NOT NULL DEFAULT 'none',
                active_tier INTEGER NOT NULL DEFAULT 0,
                card_rarity VARCHAR(24) NOT NULL DEFAULT 'operative',
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    /**
     * Returns full server-authoritative 9-slot synergies, 3-slot tactical perk deck, and Character Card.
     *
     * @return array<string, mixed>
     */
    public function snapshot(int|string $playerId): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $player = $this->loadPlayer($pid);
        [$progState] = $this->loadProgressionSafe($pid);
        $itemsCatalog = $this->loadCatalogItemsSafe();
        $loadout = LoadoutService::resolve($progState, $itemsCatalog);
        $synergies = self::evaluateSetSynergies($loadout, $progState);

        $deckRow = $this->loadOrCreateDeckRow($pid, $player, $synergies);
        $deckView = $this->buildDeckView($deckRow, $synergies, $player);
        $mergedBonuses = $this->mergeModifiers($synergies['bonuses'], $deckView['deckBonuses']);
        $characterCard = $this->buildCharacterCard($pid, $player, $progState, $loadout, $synergies, $deckView);

        return [
            'ok' => true,
            'playerId' => $pid,
            'player' => [
                'id' => $pid,
                'username' => (string) ($player['username'] ?? 'Operative'),
                'level' => (int) ($player['level'] ?? 1),
                'city' => (string) ($player['city'] ?? 'Zone City'),
                'cash' => (int) ($player['cash'] ?? 0),
                'energy' => (int) ($player['energy'] ?? 0),
                'maxEnergy' => (int) ($player['max_energy'] ?? 100),
            ],
            'loadout' => $loadout,
            'synergies' => [
                'sets' => $synergies['sets'],
                'activeSets' => $synergies['activeSets'],
                'dominantArchetype' => $synergies['dominantArchetype'],
                'dominantTier' => $synergies['dominantTier'],
                'bonuses' => $mergedBonuses,
                'setBonusesOnly' => $synergies['bonuses'],
            ],
            'perkDeck' => $deckView,
            'characterCard' => $characterCard,
        ];
    }

    /**
     * Unified router action dispatcher (`synergy.state`, `synergy.equip_card`, `synergy.unequip_card`, `synergy.set_deck`, `synergy.equip_slot`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = strtolower(trim($action));
        return match ($cleanAction) {
            '', 'synergy.state', 'state', 'snapshot' => $this->snapshot($playerId),
            'synergy.equip_card', 'deck.equip', 'equip_card' => $this->equipPerkCard(
                $playerId,
                (string) ($payload['cardId'] ?? $payload['card'] ?? ''),
                isset($payload['slot']) && $payload['slot'] !== '' ? (int) $payload['slot'] : null,
            ),
            'synergy.unequip_card', 'deck.unequip', 'unequip_card' => $this->unequipPerkCard(
                $playerId,
                isset($payload['slot']) && $payload['slot'] !== ''
                    ? (int) $payload['slot']
                    : (string) ($payload['cardId'] ?? $payload['card'] ?? ''),
            ),
            'synergy.set_deck', 'deck.set', 'set_deck' => $this->setPerkDeck(
                $playerId,
                is_array($payload['cards'] ?? null) ? $payload['cards'] : [],
            ),
            'synergy.equip_slot', 'equip_slot' => $this->equipLoadoutSlot(
                $playerId,
                (string) ($payload['slot'] ?? ''),
                isset($payload['itemId']) ? (string) $payload['itemId'] : null,
            ),
            default => throw new InvalidArgumentException("Unsupported loadout synergy action: {$action}"),
        };
    }

    /**
     * Equips one tactical perk card into the 3-slot deck (server-validated energy & uniqueness).
     *
     * @return array<string, mixed>
     */
    public function equipPerkCard(int|string $playerId, string $cardId, ?int $slotIndex = null): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $cleanCardId = strtolower(trim($cardId));
        if (!isset(self::PERK_CARDS[$cleanCardId])) {
            throw new InvalidArgumentException("Unknown tactical perk card: {$cardId}");
        }

        return $this->database->transaction(function () use ($pid, $cleanCardId, $slotIndex): array {
            $player = $this->loadPlayer($pid);
            [$progState] = $this->loadProgressionSafe($pid);
            $loadout = LoadoutService::resolve($progState, $this->loadCatalogItemsSafe());
            $synergies = self::evaluateSetSynergies($loadout, $progState);
            $row = $this->loadOrCreateDeckRow($pid, $player, $synergies);
            $slots = $this->decodeSlots((string) $row['deck_json']);
            $energyCap = $this->computeEnergyCap($player, $synergies);

            $targetSlot = $slotIndex;
            if ($targetSlot === null) {
                $emptyIdx = array_search(null, $slots, true);
                if ($emptyIdx === false) {
                    throw new InvalidArgumentException('All 3 Tactical Perk Deck slots are full. Unequip or choose a target slot (0-2).');
                }
                $targetSlot = (int) $emptyIdx;
            }
            if ($targetSlot < 0 || $targetSlot >= self::DECK_SLOT_COUNT) {
                throw new InvalidArgumentException('Tactical Perk Deck slot index must be 0, 1, or 2.');
            }

            foreach ($slots as $idx => $existing) {
                if ($idx !== $targetSlot && $existing === $cleanCardId) {
                    throw new InvalidArgumentException("Duplicate perk card '{$cleanCardId}' cannot be equipped twice.");
                }
            }

            $nextSlots = $slots;
            $nextSlots[$targetSlot] = $cleanCardId;
            $energyUsed = $this->calculateDeckEnergy($nextSlots);
            if ($energyUsed > $energyCap) {
                throw new InvalidArgumentException("Deck energy cap exceeded ({$energyUsed}/{$energyCap}). Unequip a card or pick a 1-cost skill.");
            }

            $this->persistDeck($pid, $nextSlots, $energyCap, $energyUsed, $synergies, $player, $progState, $loadout);

            $cardSpec = self::PERK_CARDS[$cleanCardId];
            $this->events->publish(new DomainEvent('LoadoutPerkCardEquipped', [
                'playerId' => $pid,
                'slot' => $targetSlot,
                'cardId' => $cleanCardId,
                'energyUsed' => $energyUsed,
                'energyCap' => $energyCap,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'synergy.equip_card';
            $snap['result'] = [
                'action' => 'equip_card',
                'slot' => $targetSlot,
                'cardId' => $cleanCardId,
                'sfxCue' => 'equip_snap',
                'summaryEn' => "{$cardSpec['nameEn']} slotted into Deck Slot " . ($targetSlot + 1) . " ({$energyUsed}/{$energyCap} Energy).",
                'summaryAr' => "تم تجهيز بطاقة «{$cardSpec['nameAr']}» في الخانة " . ($targetSlot + 1) . " ({$energyUsed}/{$energyCap} طاقة).",
            ];
            return $snap;
        });
    }

    /**
     * Unequips a tactical perk card by slot index (0-2) or card ID.
     *
     * @return array<string, mixed>
     */
    public function unequipPerkCard(int|string $playerId, int|string $slotOrCard): array
    {
        $pid = $this->normalizePlayerId($playerId);

        return $this->database->transaction(function () use ($pid, $slotOrCard): array {
            $player = $this->loadPlayer($pid);
            [$progState] = $this->loadProgressionSafe($pid);
            $loadout = LoadoutService::resolve($progState, $this->loadCatalogItemsSafe());
            $synergies = self::evaluateSetSynergies($loadout, $progState);
            $row = $this->loadOrCreateDeckRow($pid, $player, $synergies);
            $slots = $this->decodeSlots((string) $row['deck_json']);
            $energyCap = $this->computeEnergyCap($player, $synergies);

            $clearedSlot = null;
            $removedCardId = null;

            if (is_int($slotOrCard) || ctype_digit((string) $slotOrCard)) {
                $idx = (int) $slotOrCard;
                if ($idx < 0 || $idx >= self::DECK_SLOT_COUNT) {
                    throw new InvalidArgumentException('Tactical Perk Deck slot index must be 0, 1, or 2.');
                }
                $removedCardId = $slots[$idx];
                $slots[$idx] = null;
                $clearedSlot = $idx;
            } else {
                $cleanCard = strtolower(trim((string) $slotOrCard));
                if ($cleanCard === '') {
                    throw new InvalidArgumentException('Provide a valid deck slot index (0-2) or card ID to unequip.');
                }
                $foundIdx = array_search($cleanCard, $slots, true);
                if ($foundIdx === false) {
                    throw new InvalidArgumentException("Card '{$cleanCard}' is not currently equipped.");
                }
                $removedCardId = $cleanCard;
                $slots[(int) $foundIdx] = null;
                $clearedSlot = (int) $foundIdx;
            }

            $energyUsed = $this->calculateDeckEnergy($slots);
            $this->persistDeck($pid, $slots, $energyCap, $energyUsed, $synergies, $player, $progState, $loadout);

            $this->events->publish(new DomainEvent('LoadoutPerkCardUnequipped', [
                'playerId' => $pid,
                'slot' => $clearedSlot,
                'cardId' => $removedCardId,
                'energyUsed' => $energyUsed,
                'energyCap' => $energyCap,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'synergy.unequip_card';
            $snap['result'] = [
                'action' => 'unequip_card',
                'slot' => $clearedSlot,
                'cardId' => $removedCardId,
                'sfxCue' => 'ui_nav',
                'summaryEn' => 'Cleared Deck Slot ' . ($clearedSlot + 1) . " ({$energyUsed}/{$energyCap} Energy).",
                'summaryAr' => 'تم إخلاء خانة البطاقة ' . ($clearedSlot + 1) . " ({$energyUsed}/{$energyCap} طاقة).",
            ];
            return $snap;
        });
    }

    /**
     * Atomically replaces all 3 deck slots (`[?string, ?string, ?string]`).
     *
     * @param array<int, mixed> $cardIds
     * @return array<string, mixed>
     */
    public function setPerkDeck(int|string $playerId, array $cardIds): array
    {
        $pid = $this->normalizePlayerId($playerId);
        if (count($cardIds) > self::DECK_SLOT_COUNT) {
            throw new InvalidArgumentException('Tactical Perk Deck holds at most 3 cards.');
        }

        $normalized = [null, null, null];
        $seen = [];
        foreach (array_values($cardIds) as $idx => $raw) {
            if ($raw === null || $raw === '') {
                continue;
            }
            $cid = strtolower(trim((string) $raw));
            if (!isset(self::PERK_CARDS[$cid])) {
                throw new InvalidArgumentException("Unknown tactical perk card: {$cid}");
            }
            if (isset($seen[$cid])) {
                throw new InvalidArgumentException("Duplicate perk card '{$cid}' cannot be equipped twice.");
            }
            $seen[$cid] = true;
            $normalized[$idx] = $cid;
        }

        return $this->database->transaction(function () use ($pid, $normalized): array {
            $player = $this->loadPlayer($pid);
            [$progState] = $this->loadProgressionSafe($pid);
            $loadout = LoadoutService::resolve($progState, $this->loadCatalogItemsSafe());
            $synergies = self::evaluateSetSynergies($loadout, $progState);
            $this->loadOrCreateDeckRow($pid, $player, $synergies);
            $energyCap = $this->computeEnergyCap($player, $synergies);
            $energyUsed = $this->calculateDeckEnergy($normalized);
            if ($energyUsed > $energyCap) {
                throw new InvalidArgumentException("Deck energy cap exceeded ({$energyUsed}/{$energyCap}).");
            }

            $this->persistDeck($pid, $normalized, $energyCap, $energyUsed, $synergies, $player, $progState, $loadout);

            $this->events->publish(new DomainEvent('LoadoutPerkDeckUpdated', [
                'playerId' => $pid,
                'slots' => $normalized,
                'energyUsed' => $energyUsed,
                'energyCap' => $energyCap,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'synergy.set_deck';
            $snap['result'] = [
                'action' => 'set_deck',
                'slots' => $normalized,
                'sfxCue' => 'era_breakthrough',
                'summaryEn' => "Tactical Perk Deck synchronized ({$energyUsed}/{$energyCap} Energy).",
                'summaryAr' => "تمت مزامنة مجموعة المزايا التكتيكية ({$energyUsed}/{$energyCap} طاقة).",
            ];
            return $snap;
        });
    }

    /**
     * Equips an owned item into one of the 9 paperdoll slots via `LoadoutService` and refreshes synergies.
     *
     * @return array<string, mixed>
     */
    public function equipLoadoutSlot(int|string $playerId, string $slot, ?string $itemId): array
    {
        $pid = $this->normalizePlayerId($playerId);

        return $this->database->transaction(function () use ($pid, $slot, $itemId): array {
            $player = $this->loadPlayer($pid);
            [$progState, $version] = $this->loadProgressionSafe($pid);
            if ($version <= 0) {
                (new ProgressionService($this->database, $this->events))->snapshot($pid);
                [$progState, $version] = $this->loadProgressionSafe($pid);
            }
            $itemsCatalog = $this->loadCatalogItemsSafe();
            $resolved = LoadoutService::equipSlot($progState, $itemsCatalog, $slot, $itemId);
            $this->saveProgressionSafe($pid, $progState, $version, $this->nowSec());

            $synergies = self::evaluateSetSynergies($resolved, $progState);
            $row = $this->loadOrCreateDeckRow($pid, $player, $synergies);
            $slots = $this->decodeSlots((string) $row['deck_json']);
            $energyCap = $this->computeEnergyCap($player, $synergies);
            $energyUsed = $this->calculateDeckEnergy($slots);
            $this->persistDeck($pid, $slots, $energyCap, $energyUsed, $synergies, $player, $progState, $resolved);

            $snap = $this->snapshot($pid);
            $snap['route'] = 'synergy.equip_slot';
            $snap['result'] = [
                'action' => 'equip_slot',
                'slot' => $slot,
                'itemId' => $resolved['slots'][$slot] ?? null,
                'sfxCue' => $synergies['dominantTier'] >= 2 ? 'era_breakthrough' : 'equip_snap',
                'summaryEn' => "Equipped slot '{$slot}' and recalculated 9-slot set synergies.",
                'summaryAr' => "تم تجهيز خانة «{$slot}» وإعادة احتساب تناغم الطقم.",
            ];
            return $snap;
        });
    }

    /**
     * Pure deterministic evaluator for 2-piece and 4-piece Syndicate Gear Set Synergies.
     *
     * @param array<string, mixed> $loadout Output from `LoadoutService::resolve()`
     * @param array<string, mixed> $progState Player progression state (checked for RW weapons & chem stock)
     * @return array<string, mixed>
     */
    public static function evaluateSetSynergies(array $loadout, array $progState = []): array
    {
        $slots = is_array($loadout['slots'] ?? ($loadout['loadoutSlots'] ?? null))
            ? ($loadout['slots'] ?? $loadout['loadoutSlots'])
            : [];
        $inv = is_array($progState['inv'] ?? null) ? $progState['inv'] : [];
        $rwWeapons = is_array($progState['rwWeapons'] ?? null) ? $progState['rwWeapons'] : [];

        $setsOut = [];
        $activeSets = [];
        $combinedBonuses = self::emptyModifiers();
        $dominantArchetype = 'none';
        $dominantTier = 0;
        $dominantPieces = 0;

        foreach (self::SET_ARCHETYPES as $setId => $spec) {
            $matched = [];
            $itemsBySlot = is_array($spec['itemsBySlot'] ?? null) ? $spec['itemsBySlot'] : [];

            foreach ($itemsBySlot as $slot => $allowedIds) {
                $equippedId = isset($slots[$slot]) && is_string($slots[$slot]) ? $slots[$slot] : null;
                if ($equippedId === null || $equippedId === '') {
                    continue;
                }
                if (in_array($equippedId, $allowedIds, true)) {
                    $matched[] = ['slot' => $slot, 'itemId' => $equippedId];
                }
            }

            // Ranked War gilded weapons contribute a Cartel Sovereign piece if not already matched in that slot.
            if ($setId === 'cartel_sovereign' && $rwWeapons !== []) {
                $matchedSlots = array_column($matched, 'slot');
                foreach (LoadoutService::WEAPON_SLOTS as $wSlot) {
                    $eq = isset($slots[$wSlot]) && is_string($slots[$wSlot]) ? $slots[$wSlot] : null;
                    if ($eq !== null && isset($rwWeapons[$eq]) && !in_array($wSlot, $matchedSlots, true)) {
                        $matched[] = ['slot' => $wSlot, 'itemId' => $eq];
                    }
                }
            }

            // Chem Alchemist counts stocked medical/booster categories (up to +2 pieces: 1 medical + 1 booster)
            // so players can complete 2pc/4pc Chem Alchemist alongside tactical armor/med slots.
            if ($setId === 'chem_alchemist') {
                $hasMed = false;
                $hasBoost = false;
                $medIds = ['medkit', 'smallkit', 'bloodbag', 'morphine', 'pills'];
                $boostIds = ['drink', 'energydrink', 'xanax', 'vicodin', 'cannabis', 'lsd'];
                foreach ($medIds as $mid) {
                    if ((int) ($inv[$mid] ?? 0) >= 1) {
                        $hasMed = true;
                        $matched[] = ['slot' => 'stock_med', 'itemId' => $mid];
                        break;
                    }
                }
                foreach ($boostIds as $bid) {
                    if ((int) ($inv[$bid] ?? 0) >= 1) {
                        $hasBoost = true;
                        $matched[] = ['slot' => 'stock_booster', 'itemId' => $bid];
                        break;
                    }
                }
                unset($hasMed, $hasBoost);
            }

            $pieces = count($matched);
            $tier = $pieces >= 4 ? 4 : ($pieces >= 2 ? 2 : 0);
            $activeBonuses = $tier === 4
                ? ($spec['tier4Bonuses'] ?? [])
                : ($tier === 2 ? ($spec['tier2Bonuses'] ?? []) : []);

            foreach ($activeBonuses as $k => $v) {
                $combinedBonuses[$k] = ($combinedBonuses[$k] ?? 0) + (int) $v;
            }

            $entry = [
                'id' => $setId,
                'nameEn' => $spec['nameEn'],
                'nameAr' => $spec['nameAr'],
                'element' => $spec['element'],
                'role' => $spec['role'],
                'accentTone' => $spec['accentTone'],
                'crestAssetId' => $spec['crestAssetId'],
                'focusEn' => $spec['focusEn'],
                'focusAr' => $spec['focusAr'],
                'piecesCount' => $pieces,
                'maxPieces' => 4,
                'tier' => $tier,
                'active2pc' => $tier >= 2,
                'active4pc' => $tier >= 4,
                'matchedItems' => $matched,
                'bonus2En' => $spec['bonus2En'],
                'bonus2Ar' => $spec['bonus2Ar'],
                'bonus4En' => $spec['bonus4En'],
                'bonus4Ar' => $spec['bonus4Ar'],
                'activeBonuses' => $activeBonuses,
            ];

            $setsOut[] = $entry;
            if ($tier >= 2) {
                $activeSets[] = $entry;
            }
            if ($tier > $dominantTier || ($tier === $dominantTier && $pieces > $dominantPieces && $pieces > 0)) {
                $dominantTier = $tier;
                $dominantPieces = $pieces;
                $dominantArchetype = $setId;
            }
        }

        return [
            'sets' => $setsOut,
            'activeSets' => $activeSets,
            'dominantArchetype' => $dominantArchetype,
            'dominantTier' => $dominantTier,
            'bonuses' => $combinedBonuses,
        ];
    }

    /**
     * Returns unified combat + economy modifiers for downstream services (`CombatService`, `CityActivitiesService`, etc.).
     *
     * @return array<string, int>
     */
    public function getCombatAndEconomyModifiers(int|string $playerId): array
    {
        $snap = $this->snapshot($playerId);
        return is_array($snap['synergies']['bonuses'] ?? null)
            ? $snap['synergies']['bonuses']
            : self::emptyModifiers();
    }

    /**
     * Builds the `perkDeck` payload including cross-card combos and aggregated trait modifiers.
     *
     * @param array<string, mixed> $row
     * @param array<string, mixed> $synergies
     * @param array<string, mixed> $player
     * @return array<string, mixed>
     */
    private function buildDeckView(array $row, array $synergies, array $player): array
    {
        $slots = $this->decodeSlots((string) ($row['deck_json'] ?? '[]'));
        $energyCap = $this->computeEnergyCap($player, $synergies);
        $energyUsed = $this->calculateDeckEnergy($slots);

        $equippedCards = [];
        $deckBonuses = self::emptyModifiers();
        $equippedIds = [];

        foreach ($slots as $idx => $cid) {
            if ($cid === null || !isset(self::PERK_CARDS[$cid])) {
                continue;
            }
            $equippedIds[] = $cid;
            $card = self::PERK_CARDS[$cid];
            $equippedCards[] = [
                'slot' => $idx,
                'id' => $cid,
                'nameEn' => $card['nameEn'],
                'nameAr' => $card['nameAr'],
                'energyCost' => $card['energyCost'],
                'cardType' => $card['cardType'],
                'rarity' => $card['rarity'],
                'archetype' => $card['archetype'],
                'summaryEn' => $card['summaryEn'],
                'summaryAr' => $card['summaryAr'],
                'modifiers' => $card['modifiers'],
                'trait' => $card['trait'],
            ];
            foreach ($card['modifiers'] as $k => $v) {
                $deckBonuses[$k] = ($deckBonuses[$k] ?? 0) + (int) $v;
            }
        }

        $activeCombos = [];
        foreach (self::CARD_COMBOS as $combo) {
            $req = $combo['cards'];
            if (count(array_intersect($req, $equippedIds)) === count($req)) {
                $activeCombos[] = $combo;
                foreach ($combo['bonuses'] as $k => $v) {
                    $deckBonuses[$k] = ($deckBonuses[$k] ?? 0) + (int) $v;
                }
            }
        }

        $catalog = [];
        foreach (self::PERK_CARDS as $cid => $card) {
            $catalog[] = [
                'id' => $cid,
                'nameEn' => $card['nameEn'],
                'nameAr' => $card['nameAr'],
                'energyCost' => $card['energyCost'],
                'cardType' => $card['cardType'],
                'rarity' => $card['rarity'],
                'archetype' => $card['archetype'],
                'synergyTag' => $card['synergyTag'],
                'summaryEn' => $card['summaryEn'],
                'summaryAr' => $card['summaryAr'],
                'modifiers' => $card['modifiers'],
                'trait' => $card['trait'],
                'equipped' => in_array($cid, $equippedIds, true),
            ];
        }

        return [
            'slots' => $slots,
            'slotCount' => self::DECK_SLOT_COUNT,
            'equippedCards' => $equippedCards,
            'catalog' => $catalog,
            'energyUsed' => $energyUsed,
            'energyCap' => $energyCap,
            'activeCombos' => $activeCombos,
            'deckBonuses' => $deckBonuses,
        ];
    }

    /**
     * Builds a strict `character-card` SOP operative card JSON payload (no banned marketing claims, <=16-word tagline).
     *
     * @param array<string, mixed> $player
     * @param array<string, mixed> $progState
     * @param array<string, mixed> $loadout
     * @param array<string, mixed> $synergies
     * @param array<string, mixed> $deckView
     * @return array<string, mixed>
     */
    private function buildCharacterCard(
        string $playerId,
        array $player,
        array $progState,
        array $loadout,
        array $synergies,
        array $deckView,
    ): array {
        $domId = (string) ($synergies['dominantArchetype'] ?? 'none');
        $domTier = (int) ($synergies['dominantTier'] ?? 0);
        $comboCount = count($deckView['activeCombos'] ?? []);
        $cardCount = count($deckView['equippedCards'] ?? []);

        $rarity = $this->computeCardRarity($domTier, $cardCount, $comboCount);
        $archSpec = self::SET_ARCHETYPES[$domId] ?? null;

        $element = $archSpec['element'] ?? 'Neutral';
        $role = $archSpec['role'] ?? 'Operative';
        $username = (string) ($player['username'] ?? 'Operative');
        $level = max(1, (int) ($player['level'] ?? 1));
        $city = (string) ($player['city'] ?? 'Zone City');

        $taglineEn = match ($domId) {
            'ghost_operative' => 'Silent pier infiltrator striking from blind spots before alarms can trigger.',
            'iron_enforcer' => 'Armored vanguard holding narrow alleys with reinforced Kevlar and heavy steel.',
            'cartel_sovereign' => 'Syndicate broker turning street territory and bazaar margins into steady leverage.',
            'chem_alchemist' => 'Back-alley tactician calibrating trauma kits and stimulants for prolonged operations.',
            default => 'Street-tested Zone operative building tactical readiness across nine loadout slots.',
        };
        $taglineAr = match ($domId) {
            'ghost_operative' => 'متسلل صامت يضرب من النقاط العمياء قبل انطلاق أي إنذار.',
            'iron_enforcer' => 'طليعة مصفحة تحكم الأزقة بدرع الكيفلر والضربات الحاسمة.',
            'cartel_sovereign' => 'وسيط نقابي يحوّل السيطرة الميدانية وهوامش البازار إلى نفوذ دائم.',
            'chem_alchemist' => 'خبير ميداني يضبط المنشطات وحقائب الإسعاف للعمليات الطويلة.',
            default => 'عميل ميداني في مدينة زون يبني جاهزيته عبر تسع خانات عتاد.',
        };

        $archNameEn = $archSpec['nameEn'] ?? 'Unaligned Syndicate';
        $archNameAr = $archSpec['nameAr'] ?? 'نقابة حرة';
        $equippedSlots = (int) ($loadout['equippedSlotsCount'] ?? 0);

        $loreEn = "Level {$level} operative active across {$city}, running {$equippedSlots} equipped paperdoll slots under the {$archNameEn} doctrine. "
            . "Carries {$cardCount} active tactical perk cards with {$comboCount} synchronized deck combos.";
        $loreAr = "عميل من المستوى {$level} ينشط في {$city}، يجهز {$equippedSlots} خانات عتاد ضمن عقيدة {$archNameAr}. "
            . "يحمل {$cardCount} بطاقات تكتيكية نشطة مع {$comboCount} تناغمات مترابطة.";

        $assetIds = [];
        if ($archSpec !== null) {
            $assetIds[] = (string) $archSpec['crestAssetId'];
        } else {
            $assetIds[] = 'crest_operative_neutral';
        }
        $slotsMap = is_array($loadout['slots'] ?? null) ? $loadout['slots'] : [];
        foreach ($slotsMap as $itemId) {
            if (is_string($itemId) && $itemId !== '' && !in_array($itemId, $assetIds, true)) {
                $assetIds[] = $itemId;
            }
        }
        foreach ($deckView['equippedCards'] as $eqCard) {
            $cid = 'card_' . $eqCard['id'];
            if (!in_array($cid, $assetIds, true)) {
                $assetIds[] = $cid;
            }
        }

        $powerScore = (int) round(
            ($level * 25)
            + ($equippedSlots * 35)
            + ($domTier * 60)
            + ($cardCount * 40)
            + ($comboCount * 55)
            + ((float) ($loadout['weaponMultiplier'] ?? 1.0) * 20)
            + ((int) ($loadout['armorMitigationPct'] ?? 0) * 2)
        );

        return [
            'id' => 'op-' . $playerId,
            'name' => $username,
            'rarity' => $rarity,
            'element' => $element,
            'role' => $role,
            'tagline' => $taglineEn,
            'taglineEn' => $taglineEn,
            'taglineAr' => $taglineAr,
            'lore' => $loreEn,
            'loreEn' => $loreEn,
            'loreAr' => $loreAr,
            'asset_ids' => $assetIds,
            'stats' => [
                'level' => $level,
                'powerScore' => $powerScore,
                'equippedSlotsCount' => $equippedSlots,
                'armorMitigationPct' => (int) ($loadout['armorMitigationPct'] ?? 0),
                'weaponMultiplier' => (float) ($loadout['weaponMultiplier'] ?? 1.0),
                'activeArchetype' => $domId,
                'activeSetTier' => $domTier,
                'deckEnergyUsed' => (int) ($deckView['energyUsed'] ?? 0),
                'deckEnergyCap' => (int) ($deckView['energyCap'] ?? self::BASE_ENERGY_CAP),
                'comboCount' => $comboCount,
            ],
            'callsign' => (string) ($progState['ascension']['callsign'] ?? $username),
        ];
    }

    private function computeCardRarity(int $dominantTier, int $cardCount, int $comboCount): string
    {
        if ($dominantTier >= 4 && $cardCount >= 3 && $comboCount >= 1) {
            return 'mythic';
        }
        if ($dominantTier >= 4 || $comboCount >= 2) {
            return 'legendary';
        }
        if ($dominantTier >= 2 && ($cardCount >= 2 || $comboCount >= 1)) {
            return 'epic';
        }
        if ($dominantTier >= 2 || $cardCount >= 3) {
            return 'rare';
        }
        return 'operative';
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $synergies
     */
    private function computeEnergyCap(array $player, array $synergies): int
    {
        $level = (int) ($player['level'] ?? 1);
        $domTier = (int) ($synergies['dominantTier'] ?? 0);
        // Base 5 Energy cap; reaching Level 25+ with an active 4pc set unlocks 6 Energy capacity.
        $bonus = ($level >= 25 && $domTier >= 4) ? 1 : 0;
        return min(self::MAX_ENERGY_CAP, self::BASE_ENERGY_CAP + $bonus);
    }

    /**
     * @param list<?string> $slots
     */
    private function calculateDeckEnergy(array $slots): int
    {
        $total = 0;
        foreach ($slots as $cid) {
            if ($cid !== null && isset(self::PERK_CARDS[$cid])) {
                $total += (int) self::PERK_CARDS[$cid]['energyCost'];
            }
        }
        return $total;
    }

    /**
     * @return list<?string>
     */
    private function decodeSlots(string $json): array
    {
        $decoded = json_decode($json, true);
        $out = [null, null, null];
        if (!is_array($decoded)) {
            return $out;
        }
        for ($i = 0; $i < self::DECK_SLOT_COUNT; $i++) {
            $val = $decoded[$i] ?? null;
            if (is_string($val) && isset(self::PERK_CARDS[$val])) {
                $out[$i] = $val;
            }
        }
        return $out;
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $synergies
     * @return array<string, mixed>
     */
    private function loadOrCreateDeckRow(string $playerId, array $player, array $synergies): array
    {
        $row = $this->database->fetchOne(
            'SELECT * FROM player_loadout_synergies WHERE player_id = :pid',
            ['pid' => $playerId],
        );
        if ($row !== null) {
            return $row;
        }

        $defaultDeck = [null, null, null];
        $energyCap = $this->computeEnergyCap($player, $synergies);
        $domArch = (string) ($synergies['dominantArchetype'] ?? 'none');
        $domTier = (int) ($synergies['dominantTier'] ?? 0);
        $rarity = $this->computeCardRarity($domTier, 0, 0);
        $nowIso = gmdate('c', $this->nowSec());

        $this->database->insertIgnore(
            'player_loadout_synergies',
            ['player_id', 'deck_json', 'energy_cap', 'energy_used', 'active_archetype', 'active_tier', 'card_rarity', 'updated_at'],
            [$playerId, json_encode($defaultDeck, JSON_THROW_ON_ERROR), $energyCap, 0, $domArch, $domTier, $rarity, $nowIso],
        );

        $fresh = $this->database->fetchOne(
            'SELECT * FROM player_loadout_synergies WHERE player_id = :pid',
            ['pid' => $playerId],
        );
        if ($fresh === null) {
            throw new RuntimeException('Unable to initialize player loadout synergy row.');
        }
        return $fresh;
    }

    /**
     * @param list<?string> $slots
     * @param array<string, mixed> $synergies
     * @param array<string, mixed> $player
     * @param array<string, mixed> $progState
     * @param array<string, mixed> $loadout
     */
    private function persistDeck(
        string $playerId,
        array $slots,
        int $energyCap,
        int $energyUsed,
        array $synergies,
        array $player,
        array $progState,
        array $loadout,
    ): void {
        $domArch = (string) ($synergies['dominantArchetype'] ?? 'none');
        $domTier = (int) ($synergies['dominantTier'] ?? 0);
        $deckView = $this->buildDeckView(['deck_json' => json_encode($slots, JSON_THROW_ON_ERROR)], $synergies, $player);
        $card = $this->buildCharacterCard($playerId, $player, $progState, $loadout, $synergies, $deckView);

        $this->database->execute(
            'UPDATE player_loadout_synergies
             SET deck_json = :deckJson,
                 energy_cap = :energyCap,
                 energy_used = :energyUsed,
                 active_archetype = :activeArch,
                 active_tier = :activeTier,
                 card_rarity = :cardRarity,
                 updated_at = :updatedAt
             WHERE player_id = :pid',
            [
                'deckJson' => json_encode($slots, JSON_THROW_ON_ERROR),
                'energyCap' => $energyCap,
                'energyUsed' => $energyUsed,
                'activeArch' => $domArch,
                'activeTier' => $domTier,
                'cardRarity' => (string) $card['rarity'],
                'updatedAt' => gmdate('c', $this->nowSec()),
                'pid' => $playerId,
            ],
        );
    }

    /**
     * @return array<string, int>
     */
    private static function emptyModifiers(): array
    {
        return [
            'stealthPct' => 0,
            'critChancePct' => 0,
            'noiseReductionDb' => 0,
            'armorBonusPct' => 0,
            'meleeDamagePct' => 0,
            'ripostePct' => 0,
            'weaponDamagePct' => 0,
            'evasionPct' => 0,
            'mugYieldPct' => 0,
            'bazaarFeeReductionPct' => 0,
            'plunderPct' => 0,
            'medHealPct' => 0,
            'boosterPotencyPct' => 0,
            'overdoseReductionPct' => 0,
            'tempoPct' => 0,
            'escapePct' => 0,
        ];
    }

    /**
     * @param array<string, int> $a
     * @param array<string, int> $b
     * @return array<string, int>
     */
    private function mergeModifiers(array $a, array $b): array
    {
        $out = self::emptyModifiers();
        foreach ($out as $k => $v) {
            $out[$k] = (int) ($a[$k] ?? 0) + (int) ($b[$k] ?? 0);
        }
        return $out;
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $clean = trim((string) $playerId);
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player identifier for Loadout Synergy Service.');
        }
        return $clean;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :pid', ['pid' => $playerId]);
        if ($row === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }
        return $this->resources->normalize($row);
    }

    /**
     * @return array{0: array<string, mixed>, 1: int}
     */
    private function loadProgressionSafe(string $playerId): array
    {
        try {
            $row = $this->database->fetchOne(
                'SELECT state_json, version FROM player_progression WHERE player_id = :pid',
                ['pid' => $playerId],
            );
            if ($row === null) {
                return [[], 0];
            }
            $decoded = json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR);
            return [is_array($decoded) ? $decoded : [], (int) ($row['version'] ?? 1)];
        } catch (Throwable) {
            return [[], 0];
        }
    }

    /**
     * @param array<string, mixed> $state
     */
    private function saveProgressionSafe(string $playerId, array &$state, int &$version, int $nowSec): void
    {
        if ($version <= 0) {
            return;
        }
        $version++;
        $state['version'] = $version;
        $this->database->execute(
            'UPDATE player_progression SET state_json = :stateJson, version = :nextVer, updated_at = :updatedAt WHERE player_id = :pid',
            [
                'stateJson' => json_encode($state, JSON_THROW_ON_ERROR),
                'nextVer' => $version,
                'updatedAt' => gmdate('c', $nowSec),
                'pid' => $playerId,
            ],
        );
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadCatalogItemsSafe(): array
    {
        try {
            $catalog = (new GameplayCatalog($this->database, $this->events))->active();
            return is_array($catalog['items'] ?? null) ? $catalog['items'] : [];
        } catch (Throwable) {
            return [];
        }
    }

    private function nowSec(): int
    {
        if ($this->clock !== null) {
            return (int) floor((float) ($this->clock)());
        }
        return time();
    }
}

if (!class_exists('Zone\\Core\\Game\\LoadoutSynergyService', false)) {
    class_alias(LoadoutSynergyService::class, 'Zone\\Core\\Game\\LoadoutSynergyService');
}

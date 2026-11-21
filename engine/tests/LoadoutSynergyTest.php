<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\LoadoutService;
use Zone\Engine\Core\Game\LoadoutSynergyService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-loadout-synergy-' . bin2hex(random_bytes(6)) . '.sqlite';
$passed = 0;
$failed = 0;

function check(bool $condition, string $message): void
{
    global $passed, $failed;
    if (!$condition) {
        $failed++;
        fwrite(STDERR, "FAIL: {$message}\n");
        return;
    }
    $passed++;
    fwrite(STDOUT, "PASS: {$message}\n");
}

try {
    check(version_compare(PHP_VERSION, '8.5.0', '>='), 'PHP 8.5+ runtime verified (' . PHP_VERSION . ')');
    check(
        class_exists(\Zone\Engine\Core\Game\LoadoutSynergyService::class)
        && class_exists(\Zone\Core\Game\LoadoutSynergyService::class),
        'Both Zone\\Engine\\Core\\Game and Zone\\Core\\Game LoadoutSynergyService class names autoload cleanly',
    );

    // =========================================================================
    // 1. Pure 2-Piece & 4-Piece Set Synergy Evaluation Across All 4 Archetypes
    // =========================================================================
    $ghost2 = LoadoutSynergyService::evaluateSetSynergies([
        'slots' => [
            'primary' => 'sniper',
            'secondary' => 'pistol_t',
            'melee' => null,
            'temporary' => null,
            'head' => null,
            'body' => null,
            'hands' => null,
            'legs' => null,
            'feet' => null,
        ],
    ]);
    check(
        $ghost2['dominantArchetype'] === 'ghost_operative'
        && $ghost2['dominantTier'] === 2
        && $ghost2['bonuses']['stealthPct'] === 10
        && $ghost2['bonuses']['critChancePct'] === 6,
        'Ghost Operative 2-piece triggers +10% stealth & +6% crit',
    );

    $ghost4 = LoadoutSynergyService::evaluateSetSynergies([
        'slots' => [
            'primary' => 'sniper',
            'secondary' => 'pistol_t',
            'melee' => 'knife',
            'temporary' => 'smoke_grenade',
            'head' => 'paint_mask',
            'body' => null,
            'hands' => null,
            'legs' => null,
            'feet' => null,
        ],
    ]);
    check(
        $ghost4['dominantArchetype'] === 'ghost_operative'
        && $ghost4['dominantTier'] === 4
        && $ghost4['bonuses']['stealthPct'] === 22
        && $ghost4['bonuses']['critChancePct'] === 15
        && $ghost4['bonuses']['noiseReductionDb'] === 10,
        'Ghost Operative 4-piece upgrades to +22% stealth, +15% crit & -10 dB noise',
    );

    $iron4 = LoadoutSynergyService::evaluateSetSynergies([
        'slots' => [
            'primary' => 'shotgun',
            'secondary' => null,
            'melee' => 'bat',
            'temporary' => null,
            'head' => 'tac_helmet',
            'body' => 'tac_plate',
            'hands' => 'tac_gloves',
            'legs' => 'tac_greaves',
            'feet' => 'tac_boots',
        ],
    ]);
    check(
        $iron4['dominantArchetype'] === 'iron_enforcer'
        && $iron4['dominantTier'] === 4
        && $iron4['bonuses']['armorBonusPct'] === 18
        && $iron4['bonuses']['meleeDamagePct'] === 28
        && $iron4['bonuses']['ripostePct'] === 8,
        'Iron Enforcer 4-piece grants +18% armor, +28% melee & +8% riposte',
    );

    $cartel4 = LoadoutSynergyService::evaluateSetSynergies([
        'slots' => [
            'primary' => 'ak',
            'secondary' => 'magnum',
            'melee' => 'cut_throat_razor',
            'temporary' => null,
            'head' => null,
            'body' => 'vest',
            'hands' => null,
            'legs' => null,
            'feet' => null,
        ],
    ]);
    check(
        $cartel4['dominantArchetype'] === 'cartel_sovereign'
        && $cartel4['dominantTier'] === 4
        && $cartel4['bonuses']['mugYieldPct'] === 25
        && $cartel4['bonuses']['bazaarFeeReductionPct'] === 25
        && $cartel4['bonuses']['plunderPct'] === 10,
        'Cartel Sovereign 4-piece grants +25% mug yield, -25% bazaar fee & +10% plunder',
    );

    $chem4 = LoadoutSynergyService::evaluateSetSynergies([
        'slots' => [
            'primary' => null,
            'secondary' => null,
            'melee' => null,
            'temporary' => 'epinephrine',
            'head' => 'paint_mask',
            'body' => null,
            'hands' => null,
            'legs' => null,
            'feet' => null,
        ],
    ], [
        'inv' => ['medkit' => 2, 'drink' => 3],
    ]);
    check(
        $chem4['dominantArchetype'] === 'chem_alchemist'
        && $chem4['dominantTier'] === 4
        && $chem4['bonuses']['medHealPct'] === 32
        && $chem4['bonuses']['boosterPotencyPct'] === 25
        && $chem4['bonuses']['overdoseReductionPct'] === 25,
        'Chem Alchemist 4-piece evaluates equipped chem gear + stocked medical/booster mastery',
    );

    // =========================================================================
    // 2. Database Integration, 9-Slot Equip, 3-Slot Perk Deck & Energy Cap Gate
    // =========================================================================
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);

    $virtualNow = 1_750_000_000;
    $synergies = new LoadoutSynergyService(
        $database,
        $events,
        static function () use (&$virtualNow): float {
            return (float) $virtualNow;
        },
    );

    // Seed founder-player progression inventory + tactical armor so equip_slot validates ownership cleanly
    (new ProgressionService($database, $events))->snapshot('founder-player');
    $progRow = $database->fetchOne("SELECT state_json, version FROM player_progression WHERE player_id = 'founder-player'");
    $state = json_decode((string) $progRow['state_json'], true, 512, JSON_THROW_ON_ERROR);
    $state['inv']['sniper'] = 1;
    $state['inv']['pistol_t'] = 1;
    $state['inv']['knife'] = 1;
    $state['inv']['smoke_grenade'] = 1;
    $state['inv']['paint_mask'] = 1;
    $database->execute(
        "UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'",
        ['s' => json_encode($state, JSON_THROW_ON_ERROR)],
    );

    $synergies->act('founder-player', 'synergy.equip_slot', ['slot' => 'primary', 'itemId' => 'sniper']);
    $synergies->act('founder-player', 'synergy.equip_slot', ['slot' => 'secondary', 'itemId' => 'pistol_t']);
    $synergies->act('founder-player', 'synergy.equip_slot', ['slot' => 'melee', 'itemId' => 'knife']);
    $snapAfter4 = $synergies->act('founder-player', 'synergy.equip_slot', ['slot' => 'temporary', 'itemId' => 'smoke_grenade']);

    check(
        $snapAfter4['synergies']['dominantArchetype'] === 'ghost_operative'
        && $snapAfter4['synergies']['dominantTier'] === 4,
        'Server-validated equip_slot updates 9-slot paperdoll and activates 4pc Ghost Operative synergy',
    );

    // Equip valid 3-card deck within 5 Energy Cap: Double Tap (2) + Adrenaline Surge (2) + Smoke Vanish (1) = 5/5
    $synergies->act('founder-player', 'synergy.equip_card', ['cardId' => 'double_tap', 'slot' => 0]);
    $synergies->act('founder-player', 'synergy.equip_card', ['cardId' => 'adrenaline_surge', 'slot' => 1]);
    $deckSnap = $synergies->act('founder-player', 'synergy.equip_card', ['cardId' => 'smoke_vanish', 'slot' => 2]);

    check(
        $deckSnap['ok'] === true
        && $deckSnap['perkDeck']['energyUsed'] === 5
        && $deckSnap['perkDeck']['energyCap'] === 5
        && count($deckSnap['perkDeck']['equippedCards']) === 3
        && count($deckSnap['perkDeck']['activeCombos']) === 2,
        '3-Slot Perk Deck equips Double Tap + Adrenaline Surge + Smoke Vanish (5/5 Energy, 2 active combos)',
    );

    // Over-energy rejection test: replacing 1-cost Smoke Vanish with 2-cost Kevlar Ricochet (2+2+2 = 6 > 5) MUST throw
    $overCapBlocked = false;
    try {
        $synergies->act('founder-player', 'synergy.equip_card', ['cardId' => 'kevlar_ricochet', 'slot' => 2]);
    } catch (InvalidArgumentException) {
        $overCapBlocked = true;
    }
    check($overCapBlocked, 'Server rejects deck build exceeding 5 Energy cap (6/5 blocked)');

    // Duplicate card rejection test
    $dupBlocked = false;
    try {
        $synergies->act('founder-player', 'synergy.set_deck', ['cards' => ['double_tap', 'double_tap', 'smoke_vanish']]);
    } catch (InvalidArgumentException) {
        $dupBlocked = true;
    }
    check($dupBlocked, 'Server rejects duplicate perk card inside 3-slot deck');

    // Unequip card & verify persistence across fresh service instance
    $afterUnequip = $synergies->act('founder-player', 'synergy.unequip_card', ['slot' => 1]);
    check(
        $afterUnequip['perkDeck']['energyUsed'] === 3
        && count($afterUnequip['perkDeck']['equippedCards']) === 2,
        'Unequipping slot 1 frees 2 Energy cleanly (3/5 Energy remaining)',
    );

    $freshService = new LoadoutSynergyService($database, $events);
    $reloadedSnap = $freshService->snapshot('founder-player');
    check(
        $reloadedSnap['perkDeck']['slots'] === ['double_tap', null, 'smoke_vanish']
        && $reloadedSnap['perkDeck']['energyUsed'] === 3,
        'Deck state persists cleanly across fresh LoadoutSynergyService instance',
    );

    // Restore 3rd card via set_deck so Character Card hits mythic/legendary verification
    $fullSnap = $freshService->act('founder-player', 'synergy.set_deck', ['cards' => ['double_tap', 'smoke_vanish', 'clean_getaway']]);
    $card = $fullSnap['characterCard'];

    // =========================================================================
    // 3. Character Card SOP Validation (`character-card` skill)
    // =========================================================================
    $taglineWords = preg_split('/\s+/', trim((string) ($card['tagline'] ?? '')));
    $bannedFound = preg_match('/\b(?:guaranteed|unlimited|pay-to-win)\b/i', json_encode($card)) === 1;
    check(
        isset($card['id'], $card['name'], $card['rarity'], $card['element'], $card['role'], $card['tagline'], $card['lore'], $card['asset_ids'])
        && is_array($card['asset_ids'])
        && count($card['asset_ids']) >= 5
        && $card['element'] === 'Shadow'
        && $card['role'] === 'Infiltrator'
        && $card['rarity'] === 'mythic'
        && count($taglineWords ?: []) <= 16
        && !$bannedFound,
        'Character Card matches strict character-card SOP schema, <=16-word tagline, zero banned terms, & mythic rarity',
    );

    // =========================================================================
    // 4. Trait Schema Parity (`traits` skill) & Numeric int|string Player ID
    // =========================================================================
    $allTraitsValid = true;
    foreach ($fullSnap['perkDeck']['catalog'] as $cEntry) {
        $tr = $cEntry['trait'] ?? [];
        if (($tr['description'] ?? '') !== ($tr['quirk'] ?? 'x') || empty($tr['abilities']) || !isset($tr['unlockedBy'], $tr['excludedBy'])) {
            $allTraitsValid = false;
        }
    }
    check($allTraitsValid, 'All 6 Tactical Perk Cards comply with traits schema (identical description/quirk + modifier arrays)');

    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['42', 'NumericSynergyAgent', 12, 4200, 50000, 100, 45, 1200, 500, 100, 45, 1200, 500, gmdate('c'), 240, 220, 250, 260, 0, 'Zone City', 3, gmdate('Y-m-d')],
    );
    $intSnap = $freshService->snapshot(42);
    check(
        $intSnap['ok'] === true && $intSnap['playerId'] === '42' && $intSnap['characterCard']['id'] === 'op-42',
        'Service accepts integer player IDs alongside string IDs',
    );

    // =========================================================================
    // 5. SQL Dual-Law Static Source Audit (PG16 + SQLite 3)
    // =========================================================================
    $serviceSource = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/LoadoutSynergyService.php');
    $codeWithoutComments = '';
    foreach (token_get_all($serviceSource) as $tok) {
        if (is_array($tok) && in_array($tok[0], [T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }
        $codeWithoutComments .= is_array($tok) ? $tok[1] : $tok;
    }
    check(
        preg_match('/\b(?:MAX|MIN)\s*\([^,)]+,[^)]+\)/', $codeWithoutComments) !== 1,
        'SQL Dual Law: Zero 2-argument SQLite scalar MAX(a,b)/MIN(a,b) calls in SQL',
    );

    preg_match_all('/(?:SELECT|INSERT\s+INTO|UPDATE|CREATE\s+TABLE)[\s\S]*?(?:\'\s*,|"\s*,|\'\s*\)|"\s*\))/', $codeWithoutComments, $sqlBlocks);
    $duplicateParamFound = false;
    foreach ($sqlBlocks[0] as $sqlBlock) {
        if (preg_match_all('/:[a-zA-Z_][a-zA-Z0-9_]*/', $sqlBlock, $pMatches)) {
            $counts = array_count_values($pMatches[0]);
            foreach ($counts as $cnt) {
                if ($cnt > 1) {
                    $duplicateParamFound = true;
                }
            }
        }
    }
    check(!$duplicateParamFound, 'SQL Dual Law: Every SQL statement uses strictly unique named PDO parameters');
} finally {
    foreach (['', '-wal', '-shm'] as $suffix) {
        if (is_file($databasePath . $suffix)) {
            @unlink($databasePath . $suffix);
        }
    }
}

fwrite(STDOUT, "\nLoadoutSynergyTest Summary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);

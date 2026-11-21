<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\SyndicateCompanionService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-syndicate-companion-' . bin2hex(random_bytes(6)) . '.sqlite';
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
        class_exists(\Zone\Engine\Core\Game\SyndicateCompanionService::class)
        && class_exists(\Zone\Core\Game\SyndicateCompanionService::class),
        'Both Zone\\Engine\\Core\\Game and Zone\\Core\\Game SyndicateCompanionService class names autoload cleanly',
    );

    // =========================================================================
    // 1. Pure 4-Stage Guardian/Companion Evolution Curve & 4 Unit Modifiers
    // =========================================================================
    $st1 = SyndicateCompanionService::resolveStageForXp(0);
    $st2 = SyndicateCompanionService::resolveStageForXp(100);
    $st3 = SyndicateCompanionService::resolveStageForXp(300);
    $st4 = SyndicateCompanionService::resolveStageForXp(600);

    check(
        $st1['stage'] === 1 && $st1['nameEn'] === 'Stage I: Prototype/Pup'
        && $st2['stage'] === 2 && $st2['nameEn'] === 'Stage II: Street Scout'
        && $st3['stage'] === 3 && $st3['nameEn'] === 'Stage III: Tactical Vanguard'
        && $st4['stage'] === 4 && $st4['nameEn'] === 'Stage IV: Sovereign Apex' && $st4['nextStageXp'] === null,
        '4-Stage Evolution thresholds resolve Stage I (0) -> Stage II (100) -> Stage III (300) -> Stage IV (600)',
    );

    $droneMods = SyndicateCompanionService::computeUnitModifiers('recon_drone', 4, 85, 90);
    $k9Mods = SyndicateCompanionService::computeUnitModifiers('armored_k9', 4, 85, 90);
    $falconMods = SyndicateCompanionService::computeUnitModifiers('smuggler_falcon', 4, 85, 90);
    $ravenMods = SyndicateCompanionService::computeUnitModifiers('cyber_raven', 4, 85, 90);

    check(
        $droneMods['stealthPct'] >= 26 && $droneMods['visionBlindSpotDeg'] >= 32
        && $k9Mods['combatDamagePct'] >= 25 && $k9Mods['counterBleedPct'] >= 22
        && $falconMods['travelSpeedPct'] >= 27 && $falconMods['contrabandCapacity'] >= 11
        && $ravenMods['bazaarFeeReductionPct'] >= 22 && $ravenMods['vaultHackPct'] >= 27,
        'All 4 Syndicate companion units compute distinct Stage IV combat, stealth, travel & bazaar modifiers',
    );

    // =========================================================================
    // 2. Database Integration: Starter Companion, Adopt, Switch Active & Feed
    // =========================================================================
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);

    $virtualNow = 1_760_000_000;
    $companions = new SyndicateCompanionService(
        $database,
        $events,
        static function () use (&$virtualNow): float {
            return (float) $virtualNow;
        },
    );

    $initialSnap = $companions->snapshot('founder-player');
    check(
        $initialSnap['ok'] === true
        && $initialSnap['activeUnitId'] === 'recon_drone'
        && $initialSnap['activeCompanion']['stage'] === 1
        && count($initialSnap['roster']) === 4,
        'Initial snapshot auto-provisions Stage I recon_drone as active alongside 4-unit roster',
    );

    // Adopt armored_k9, smuggler_falcon, and cyber_raven
    $adoptK9 = $companions->act('founder-player', 'adopt_companion', [
        'unitId' => 'armored_k9',
        'callsign' => 'FENRIR-01',
    ]);
    check(
        $adoptK9['ok'] === true
        && $adoptK9['activeUnitId'] === 'armored_k9'
        && $adoptK9['activeCompanion']['callsign'] === 'FENRIR-01'
        && $adoptK9['activeCompanion']['adopted'] === true,
        'adopt_companion commissions armored_k9 with custom callsign FENRIR-01 and sets it active',
    );

    $companions->act('founder-player', 'adopt_companion', ['unitId' => 'smuggler_falcon', 'setActive' => false]);
    $companions->act('founder-player', 'adopt_companion', ['unitId' => 'cyber_raven', 'setActive' => false]);

    // Switch active back and forth
    $switchedFalcon = $companions->act('founder-player', 'switch_active', ['unitId' => 'smuggler_falcon']);
    check(
        $switchedFalcon['activeUnitId'] === 'smuggler_falcon'
        && $switchedFalcon['modifiers']['travelSpeedPct'] >= 8
        && $switchedFalcon['modifiers']['contrabandCapacity'] >= 2,
        'switch_active switches active unit to smuggler_falcon and exposes travel speed & contraband modifiers',
    );

    $companions->act('founder-player', 'switch_active', ['unitId' => 'armored_k9']);

    // Feed/Maintain increases Bond & Readiness
    $beforeFeed = $companions->snapshot('founder-player')['activeCompanion'];
    $afterFeed = $companions->act('founder-player', 'feed_maintain', ['unitId' => 'armored_k9']);
    check(
        $afterFeed['activeCompanion']['bond'] > $beforeFeed['bond']
        && $afterFeed['activeCompanion']['readiness'] >= $beforeFeed['readiness']
        && $afterFeed['activeCompanion']['evolutionXp'] === $beforeFeed['evolutionXp'] + 20,
        'feed_maintain boosts companion Bond, Readiness, Care Score & awards +20 Evolution XP',
    );

    // =========================================================================
    // 3. Train Drill (5E Cost + Auto-Evolution Stage I -> II -> III -> IV)
    // =========================================================================
    $energyBefore = (int) $afterFeed['player']['energy'];
    $drill1 = $companions->act('founder-player', 'train_drill', ['unitId' => 'armored_k9']);
    check(
        $drill1['player']['energy'] === $energyBefore - 5
        && $drill1['result']['energySpent'] === 5
        && $drill1['result']['evolved'] === true
        && $drill1['activeCompanion']['stage'] === 2,
        'First train_drill spends 5E and auto-evolves companion from Stage I to Stage II (Street Scout)',
    );

    // Run drills to evolve through Stage III (300 XP) and Stage IV (600 XP)
    $companions->act('founder-player', 'train_drill', ['unitId' => 'armored_k9']);
    $drillStage3 = $companions->act('founder-player', 'train_drill', ['unitId' => 'armored_k9']);
    check(
        $drillStage3['activeCompanion']['stage'] === 3
        && $drillStage3['activeCompanion']['stageNameEn'] === 'Stage III: Tactical Vanguard',
        'Subsequent train_drill auto-evolves companion to Stage III (Tactical Vanguard) at 300+ XP',
    );

    // Keep readiness topped up and push to Stage IV (600+ XP)
    $companions->act('founder-player', 'feed_maintain', ['unitId' => 'armored_k9']);
    $companions->act('founder-player', 'train_drill', ['unitId' => 'armored_k9']);
    $companions->act('founder-player', 'train_drill', ['unitId' => 'armored_k9']);
    $drillStage4 = $companions->act('founder-player', 'train_drill', ['unitId' => 'armored_k9']);
    check(
        $drillStage4['activeCompanion']['stage'] === 4
        && $drillStage4['activeCompanion']['stageNameEn'] === 'Stage IV: Sovereign Apex'
        && $drillStage4['activeCompanion']['level'] >= 40,
        'Companion auto-evolves to Stage IV (Sovereign Apex, Level 40+) at 600+ Evolution XP',
    );

    // =========================================================================
    // 4. Cooldown-Gated Patrol Dispatch & Clock Advance Verification
    // =========================================================================
    $cashBeforePatrol = (int) $drillStage4['player']['cash'];
    $patrol1 = $companions->act('founder-player', 'patrol_dispatch', [
        'unitId' => 'armored_k9',
        'sector' => 'fin',
    ]);
    check(
        $patrol1['ok'] === true
        && $patrol1['player']['cash'] > $cashBeforePatrol
        && $patrol1['result']['cashEarned'] >= 1500
        && $patrol1['result']['loot']['itemId'] === 'enforcer_tactical_cache'
        && $patrol1['activeCompanion']['patrolCooldownRemainingSec'] === SyndicateCompanionService::PATROL_COOLDOWN_SEC,
        'patrol_dispatch grants passive Syndicate cash + unit-specific loot and arms 180s patrol cooldown',
    );

    // Immediate second patrol must be blocked by cooldown gate
    $cooldownBlocked = false;
    try {
        $companions->act('founder-player', 'patrol_dispatch', ['unitId' => 'armored_k9']);
    } catch (InvalidArgumentException) {
        $cooldownBlocked = true;
    }
    check($cooldownBlocked, 'patrol_dispatch rejects duplicate dispatch while cooldown is active');

    // Advance clock past 180s cooldown and dispatch again
    $virtualNow += 185;
    $patrol2 = $companions->act('founder-player', 'patrol_dispatch', ['unitId' => 'armored_k9', 'sector' => 'north']);
    check(
        $patrol2['ok'] === true && $patrol2['activeCompanion']['patrolCount'] === 2,
        'patrol_dispatch succeeds cleanly once 180s cooldown expires',
    );

    // =========================================================================
    // 5. Numeric int|string Player ID Support & Un-Adopted Switch Rejection
    // =========================================================================
    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['77', 'NumericCompanionAgent', 15, 5200, 75000, 100, 45, 1200, 500, 100, 45, 1200, 500, gmdate('c'), 250, 240, 260, 255, 0, 'Zone City', 4, gmdate('Y-m-d')],
    );
    $numSnap = $companions->snapshot(77);
    check(
        $numSnap['ok'] === true && $numSnap['playerId'] === '77' && $numSnap['activeUnitId'] === 'recon_drone',
        'Service accepts integer player IDs alongside string player IDs',
    );

    $unadoptedBlocked = false;
    try {
        $companions->switchActive(77, 'cyber_raven');
    } catch (InvalidArgumentException) {
        $unadoptedBlocked = true;
    }
    check($unadoptedBlocked, 'switchActive rejects switching to an un-adopted unit until adopt_companion is called');

    // =========================================================================
    // 6. SQL Dual-Law Static Source Audit (PG16 + SQLite 3)
    // =========================================================================
    $serviceSource = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/SyndicateCompanionService.php');
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

fwrite(STDOUT, "\nSyndicateCompanionTest Summary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);

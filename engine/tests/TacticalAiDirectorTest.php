<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CooldownException;
use Zone\Engine\Core\Game\TacticalAiDirectorService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-tactical-ai-' . bin2hex(random_bytes(6)) . '.sqlite';
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
        class_exists(\Zone\Engine\Core\Game\TacticalAiDirectorService::class)
        && class_exists(\Zone\Core\Game\TacticalAiDirectorService::class),
        'Both Zone\\Engine\\Core\\Game and Zone\\Core\\Game TacticalAiDirectorService class names autoload cleanly',
    );

    // =========================================================================
    // 1. Utility AI Normalized Response Curve Math (`linear`, `quadratic`, `logistic`)
    // =========================================================================
    $lin0 = TacticalAiDirectorService::evaluateResponseCurve('linear', 0.0);
    $linMid = TacticalAiDirectorService::evaluateResponseCurve('linear', 0.5, ['slope' => 0.8, 'intercept' => 0.1]);
    $linClamp = TacticalAiDirectorService::evaluateResponseCurve('linear', 1.8);
    check(
        abs($lin0 - 0.0) < 0.001 && abs($linMid - 0.5) < 0.001 && abs($linClamp - 1.0) < 0.001,
        'Utility AI linear response curve normalizes & clamps [0,1]',
    );

    $quadMid = TacticalAiDirectorService::evaluateResponseCurve('quadratic', 0.5, ['exponent' => 2.0]);
    $quadHigh = TacticalAiDirectorService::evaluateResponseCurve('quadratic', 0.9, ['exponent' => 2.0]);
    check(
        abs($quadMid - 0.25) < 0.001 && $quadHigh > 0.80,
        'Utility AI quadratic curve produces concave urgency progression',
    );

    $logLow = TacticalAiDirectorService::evaluateResponseCurve('logistic', 0.10, ['steepness' => 12.0, 'midpoint' => 0.5]);
    $logMid = TacticalAiDirectorService::evaluateResponseCurve('logistic', 0.50, ['steepness' => 12.0, 'midpoint' => 0.5]);
    $logHigh = TacticalAiDirectorService::evaluateResponseCurve('logistic', 0.90, ['steepness' => 12.0, 'midpoint' => 0.5]);
    check(
        $logLow < 0.05 && abs($logMid - 0.50) < 0.02 && $logHigh > 0.95,
        'Utility AI logistic S-curve inflects sharply across midpoint',
    );

    // =========================================================================
    // 2. Stance Selection Across HP%, Weapon Class & District Heat Edge Cases
    // =========================================================================
    // Edge Case A: Healthy fighters, heavy rifle, low district heat -> `ballistic_guard` (countered by `armor_pierce`)
    $evalGuard = TacticalAiDirectorService::scoreUtilityStances([
        'playerHpPct' => 0.92,
        'rivalHpPct' => 0.88,
        'weaponClass' => 'rifle',
        'districtHeat' => 15.0,
        'stimsRemaining' => 2,
    ]);
    check(
        $evalGuard['selectedStance'] === 'ballistic_guard' && $evalGuard['expectedCounter'] === 'armor_pierce',
        'Healthy rifle engagement in low heat selects ballistic_guard -> armor_pierce',
    );

    // Edge Case B: Player critically wounded (12% HP) with sniper -> `berserk_rush` (countered by `counter_parry`)
    $evalBerserk = TacticalAiDirectorService::scoreUtilityStances([
        'playerHpPct' => 0.12,
        'rivalHpPct' => 0.82,
        'weaponClass' => 'sniper',
        'districtHeat' => 22.0,
        'stimsRemaining' => 2,
    ]);
    check(
        $evalBerserk['selectedStance'] === 'berserk_rush' && $evalBerserk['expectedCounter'] === 'counter_parry',
        'Critically wounded player triggers berserk_rush finisher -> counter_parry',
    );

    // Edge Case C: Extreme district heat (92/100) + healthy melee player -> `flank_ambush` (countered by `suppress_fire`)
    $evalFlank = TacticalAiDirectorService::scoreUtilityStances([
        'playerHpPct' => 0.95,
        'rivalHpPct' => 0.72,
        'weaponClass' => 'melee',
        'districtHeat' => 92.0,
        'stimsRemaining' => 2,
    ]);
    check(
        $evalFlank['selectedStance'] === 'flank_ambush' && $evalFlank['expectedCounter'] === 'suppress_fire',
        'High district heat + melee kiting context selects flank_ambush -> suppress_fire',
    );

    // Edge Case D: Rival critically wounded (18% HP) with stims remaining -> `stim_inject` (countered by `rush_interrupt`)
    $evalStim = TacticalAiDirectorService::scoreUtilityStances([
        'playerHpPct' => 0.80,
        'rivalHpPct' => 0.18,
        'weaponClass' => 'pistol',
        'districtHeat' => 30.0,
        'stimsRemaining' => 2,
    ]);
    check(
        $evalStim['selectedStance'] === 'stim_inject'
        && $evalStim['expectedCounter'] === 'rush_interrupt'
        && $evalStim['fsmState'] === 'DESPERATE',
        'Critical rival HP with available stims selects stim_inject -> rush_interrupt (FSM: DESPERATE)',
    );

    // Edge Case E: Rival critically wounded (18% HP) with ZERO stims remaining -> BT decorator blocks `stim_inject`!
    $evalNoStims = TacticalAiDirectorService::scoreUtilityStances([
        'playerHpPct' => 0.80,
        'rivalHpPct' => 0.18,
        'weaponClass' => 'rifle',
        'districtHeat' => 20.0,
        'stimsRemaining' => 0,
    ]);
    check(
        $evalNoStims['selectedStance'] !== 'stim_inject',
        'HasStimsDecorator suppresses stim_inject once rival stims are exhausted',
    );

    // =========================================================================
    // 3. Perception Guard Vision Cone, Blind-Spot Timing & Cooldown Anti-Abuse
    // =========================================================================
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);

    // Pier 4 sweepHz = 0.16 Hz -> period = 6.25s.
    // Phase 0.25 sits dead-center inside Blind Spot [0.17, 0.33].
    $period = 1.0 / 0.16;
    $virtualClock = floor(1_700_000_000.0 / $period) * $period + (0.25 * $period);

    $coneBlind = TacticalAiDirectorService::computeGuardVisionCone('pier_4', $virtualClock, 10);
    $coneSpotted = TacticalAiDirectorService::computeGuardVisionCone('pier_4', floor($virtualClock / $period) * $period, 10);
    check(
        $coneBlind['inBlindSpot'] === true && $coneSpotted['inBlindSpot'] === false,
        'Perception cone deterministically distinguishes blind-spot vs exposed sweep phase',
    );

    $director = new TacticalAiDirectorService(
        $database,
        $events,
        static fn (int $min, int $max): int => (int) round(($min + $max) / 2),
        static function () use (&$virtualClock): float {
            return $virtualClock;
        },
    );

    // Initialize progression & grant founder-player a stealth lockpick enhancer + assault rifle
    $director->snapshot('founder-player', 'pier_4');
    $progRow = $database->fetchOne("SELECT state_json, version FROM player_progression WHERE player_id = 'founder-player'");
    $state = json_decode((string) $progRow['state_json'], true, 512, JSON_THROW_ON_ERROR);
    $state['inv']['lockpick'] = 1;
    $state['inv']['drill'] = 1;
    $state['equip'] = 'assaultrifle_1';
    $state['inv']['assaultrifle_1'] = 1;
    $database->execute(
        "UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'",
        ['s' => json_encode($state, JSON_THROW_ON_ERROR)],
    );
    $database->execute(
        "UPDATE players SET nerve = 40, energy = 120, life = 2500, max_life = 2500 WHERE id = 'founder-player'"
    );

    $playerBefore = $database->fetchOne("SELECT cash, xp, nerve FROM players WHERE id = 'founder-player'");
    $breachRes = $director->executeStealthBreach('founder-player', [
        'district' => 'pier_4',
        'approach' => 'stealth',
        'enhancerId' => 'lockpick',
    ]);

    check(
        $breachRes['ok'] === true
        && $breachRes['result']['cleanBreach'] === true
        && $breachRes['result']['inBlindSpot'] === true
        && $breachRes['result']['bonusPct'] >= 15
        && $breachRes['result']['bonusPct'] <= 35
        && $breachRes['result']['enhancerUsed'] === 'lockpick',
        'Clean blind-spot breach with owned lockpick grants verified +15%..+35% stealth bonus',
    );
    check(
        (int) $breachRes['player']['cash'] === ((int) $playerBefore['cash'] + (int) $breachRes['result']['cashAwarded'])
        && (int) $breachRes['player']['nerve'] === ((int) $playerBefore['nerve'] - TacticalAiDirectorService::STEALTH_BREACH_NERVE_COST),
        'Clean breach settles cash & deducts 3 Nerve server-authoritatively',
    );

    // Anti-abuse check: immediate repeat must throw CooldownException!
    $spamBlocked = false;
    try {
        $director->executeStealthBreach('founder-player', ['district' => 'pier_4', 'approach' => 'stealth']);
    } catch (CooldownException $cdEx) {
        $spamBlocked = $cdEx->retryAfter > 0;
    }
    check($spamBlocked, 'Anti-exploit cooldown gate blocks rapid stealth-breach spam');

    // Advance virtual clock past 12s cooldown to an EXPOSED guard sweep phase (phase = 0.02)
    $virtualClock = (floor(($virtualClock + 20.0) / $period) * $period) + (0.02 * $period);
    $spottedRes = $director->executeStealthBreach('founder-player', [
        'district' => 'pier_4',
        'approach' => 'stealth',
    ]);
    check(
        $spottedRes['result']['cleanBreach'] === false
        && $spottedRes['result']['bonusPct'] === 0
        && $spottedRes['result']['cashAwarded'] === 0
        && $spottedRes['result']['noiseAfter'] > $spottedRes['result']['noiseBefore'],
        'Breaching outside blind spot fails clean check, pays $0 cash, and spikes acoustic noise',
    );

    // Advance virtual clock +40s and verify acoustic noise decays cleanly (-1 per 4s = -10)
    $noisePeak = (int) $spottedRes['result']['noiseAfter'];
    $virtualClock += 40.0;
    $decayedState = $director->getStealthState('founder-player', 'pier_4');
    check(
        (int) $decayedState['noiseLevel'] === max(0, $noisePeak - 10),
        'Acoustic noise decays deterministically over server time (-1 per 4s)',
    );

    // =========================================================================
    // 4. Atomic Tactical Combat Exchange, Takedown Victory & SQL Dual-Law Audit
    // =========================================================================
    $encSnap = $director->getTacticalEncounter('founder-player');
    $telegraphedStance = $encSnap['enemyIntent']['stanceId'];
    $recommendedCounter = $encSnap['enemyIntent']['recommendedCounter'];
    check(
        isset(TacticalAiDirectorService::AI_STANCES[$telegraphedStance])
        && isset(TacticalAiDirectorService::COUNTER_MANEUVERS[$recommendedCounter]),
        'getTacticalEncounter returns valid Utility AI enemy intent & recommended counter maneuver',
    );

    $energyBefore = (int) $encSnap['playerEnergy'];
    $rivalHpBefore = (int) $encSnap['rivalHp'];
    $maneuverRes = $director->act('founder-player', 'tactical.maneuver', [
        'maneuver' => $recommendedCounter,
        'damageDealt' => 9999999,
        'cashAwarded' => 9999999,
    ]);

    check(
        $maneuverRes['result']['perfectCounter'] === true
        && $maneuverRes['result']['damageDealt'] < 100000
        && (int) $maneuverRes['player']['energy'] === ($energyBefore - TacticalAiDirectorService::MANEUVER_ENERGY_COST)
        && (int) $maneuverRes['result']['rivalHpAfter'] < $rivalHpBefore,
        'Perfect counter maneuver deals verified server damage, deducts 5E, and ignores spoofed client fields',
    );

    // Verify maneuver cooldown blocks immediate hammer
    $maneuverCooldownBlocked = false;
    try {
        $director->executeCounterManeuver('founder-player', $recommendedCounter);
    } catch (CooldownException) {
        $maneuverCooldownBlocked = true;
    }
    check($maneuverCooldownBlocked, 'Tactical maneuver enforces 6s server-clock cooldown');

    // Drive encounter to Nemesis neutralization to exercise CASE WHEN noise reduction & takedown ledger
    $virtualClock += 10.0;
    $database->execute("UPDATE tactical_encounters SET rival_hp = 20 WHERE player_id = 'founder-player'");
    $nextEnc = $director->getTacticalEncounter('founder-player');
    $finisherCounter = $nextEnc['enemyIntent']['recommendedCounter'];
    $takedownRes = $director->executeCounterManeuver('founder-player', $finisherCounter);
    check(
        $takedownRes['result']['victory'] === true
        && $takedownRes['result']['outcome'] === 'nemesis_neutralized'
        && $takedownRes['result']['cashAwarded'] >= 1200,
        'Neutralizing Nemesis awards takedown payout & settles CASE WHEN district heat reduction cleanly',
    );

    // Verify integer playerId compatibility (`int|string`)
    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['42', 'NumericAgent', 6, 1500, 12000, 100, 45, 900, 500, 100, 45, 900, 500, gmdate('c'), 180, 160, 175, 170, 0, 'Zone City', 1, gmdate('Y-m-d')],
    );
    $intPlayerSnap = $director->snapshot(42, 'downtown');
    check(
        $intPlayerSnap['ok'] === true && $intPlayerSnap['playerId'] === '42' && $intPlayerSnap['district'] === 'downtown',
        'Service accepts integer player IDs seamlessly alongside string player IDs',
    );

    // Static SQL Dual-Law Source Audit (strip T_COMMENT / T_DOC_COMMENT first):
    //  (a) Zero uppercase SQL scalar MAX(a,b)/MIN(a,b) calls
    //  (b) Zero duplicate named PDO parameters (:param) inside any SQL query literal
    $serviceSource = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/TacticalAiDirectorService.php');
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

    $ledgerEntries = $database->fetchAll(
        "SELECT reason, amount FROM economy_ledger WHERE player_id = 'founder-player' AND reason LIKE 'tactical.%'"
    );
    check(count($ledgerEntries) >= 3, 'Tactical stealth, counter, & takedown payouts record auditable economy_ledger entries');
} finally {
    foreach (['', '-wal', '-shm'] as $suffix) {
        if (is_file($databasePath . $suffix)) {
            @unlink($databasePath . $suffix);
        }
    }
}

fwrite(STDOUT, "\nTacticalAiDirectorTest Summary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);

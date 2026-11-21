<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\EconomyAntiCheatService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-econ-anticheat-' . bin2hex(random_bytes(6)) . '.sqlite';
$passed = 0;
$failed = 0;

function assertCheck(bool $condition, string $message): void
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
    assertCheck(version_compare(PHP_VERSION, '8.5.0', '>='), 'PHP 8.5+ runtime active');

    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $ledger = new Ledger($database);
    $events = new EventBus($database);

    $simulatedNowMs = 1_795_200_000_000;
    $clock = static function () use (&$simulatedNowMs): int {
        return $simulatedNowMs;
    };

    $service = new EconomyAntiCheatService($database, $ledger, $events, $clock);

    // Verify both canonical Zone\Engine\Core\Game and Zone\Core\Game alias resolve cleanly
    assertCheck(
        class_exists(\Zone\Core\Game\EconomyAntiCheatService::class),
        'Zone\\Core\\Game\\EconomyAntiCheatService class alias is registered alongside Zone\\Engine\\Core\\Game'
    );

    // -------------------------------------------------------------------------
    // 1. MMO Sink/Faucet Equilibrium Band Math (1.08 - 1.15)
    // -------------------------------------------------------------------------
    $zeroEq = EconomyAntiCheatService::computeEquilibriumMetrics(0, 0);
    assertCheck(
        $zeroEq['inHealthyBand'] === true
        && $zeroEq['faucetSinkRatio'] >= 1.08
        && $zeroEq['faucetSinkRatio'] <= 1.15,
        'fresh boot (0 faucets / 0 sinks) defaults cleanly into 1.08 - 1.15 healthy equilibrium band'
    );

    $healthyEq = EconomyAntiCheatService::computeEquilibriumMetrics(11_150, 10_000);
    assertCheck(
        abs($healthyEq['faucetSinkRatio'] - 1.115) < 0.0001
        && $healthyEq['inHealthyBand'] === true
        && $healthyEq['bandStatus'] === 'healthy_equilibrium'
        && $healthyEq['sinkPriceStabilizer'] === 1.0,
        '11,150 faucets / 10,000 sinks resolves to 1.115 healthy_equilibrium with 1.0x stabilizer'
    );

    $deflationEq = EconomyAntiCheatService::computeEquilibriumMetrics(9_000, 10_000);
    assertCheck(
        abs($deflationEq['faucetSinkRatio'] - 0.90) < 0.0001
        && $deflationEq['inHealthyBand'] === false
        && $deflationEq['bandStatus'] === 'deflationary'
        && $deflationEq['sinkPriceStabilizer'] < 1.0,
        '0.90 ratio flags deflationary band and discounts voluntary sink prices (< 1.0x)'
    );

    $inflationEq = EconomyAntiCheatService::computeEquilibriumMetrics(22_000, 10_000);
    assertCheck(
        abs($inflationEq['faucetSinkRatio'] - 2.20) < 0.0001
        && $inflationEq['inHealthyBand'] === false
        && $inflationEq['bandStatus'] === 'hyperinflation_alert'
        && $inflationEq['sinkPriceStabilizer'] > 1.20,
        '2.20 ratio flags hyperinflation_alert and deepens progressive sink stabilizer (> 1.20x)'
    );

    // -------------------------------------------------------------------------
    // 2. Era & Level-Scaled Syndicate Sink Pricing (Newbie-Safe vs Sovereign Drain)
    // -------------------------------------------------------------------------
    $lv1Launder = EconomyAntiCheatService::calculateSinkPrice('launder_heat', 1, 3_500, 1.0);
    $lv1Hone = EconomyAntiCheatService::calculateSinkPrice('hone_weapon', 1, 3_500, 1.0);
    $lv12Launder = EconomyAntiCheatService::calculateSinkPrice('launder_heat', 12, 300_000, 1.0);
    $lv28Launder = EconomyAntiCheatService::calculateSinkPrice('launder_heat', 28, 12_000_000, 1.0);

    assertCheck(
        $lv1Launder === 450 && $lv1Hone === 600,
        'Level 1 Era I Gutter Rat pays beginner-friendly $450 / $600 sink prices'
    );
    assertCheck(
        $lv28Launder > $lv12Launder && $lv12Launder > ($lv1Launder * 5),
        "Progressive Era/Level/NetWorth sink scaling holds (Lv1=\${$lv1Launder} < Lv12=\${$lv12Launder} < Lv28=\${$lv28Launder})"
    );

    // -------------------------------------------------------------------------
    // 3. Live Syndicate Sinks Settlement, Buffs, Heat Drop, Jail/Hosp Cut & 24h Ratio
    // -------------------------------------------------------------------------
    $nowIso = gmdate('c', intdiv($simulatedNowMs, 1000));
    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['1001', 'Operative_1001', 4, 450, 25_000, 100, 45, 300, 500, 100, 45, 300, 500, $nowIso, 50, 50, 50, 50, 10_000, 'Zone City', 1, gmdate('Y-m-d')]
    );

    // Seed initial progression with elevated North Harbor heat (78) + active 20m jail & 30m hospital timers
    $initialProg = [
        'version' => 1,
        'districtHeat' => ['north' => 78, 'red' => 62],
        'jailUntil' => $simulatedNowMs + 1_200_000, // 20m
        'hospUntil' => $simulatedNowMs + 1_800_000, // 30m
    ];
    $database->execute(
        'INSERT INTO player_progression (player_id, state_json, version, updated_at) VALUES (:pid, :json, 1, :upd)',
        ['pid' => '1001', 'json' => json_encode($initialProg, JSON_THROW_ON_ERROR), 'upd' => $nowIso]
    );

    // Record faucet reward + non-faucet bank deposit (bank.deposit must NOT distort faucet ratio)
    $ledger->record('1001', 'cash', 3_600, 28_600, 'crime.reward', bin2hex(random_bytes(16)));
    $ledger->record('1001', 'cash', -5_000, 23_600, 'bank.deposit', bin2hex(random_bytes(16)));

    // Execute all 3 Syndicate Sinks using integer $playerId (testing int|string union compatibility)
    $launderOut = $service->executeSyndicateSink(1001, 'launder_heat', [
        'districtId' => 'north',
        'nonce' => 'sink-nonce-launder-1',
    ]);
    $simulatedNowMs += 250;

    $honeOut = $service->executeSyndicateSink(1001, 'hone_weapon', [
        'nonce' => 'sink-nonce-hone-1',
    ]);
    $simulatedNowMs += 250;

    $bribeOut = $service->executeSyndicateSink(1001, 'bribe_wardens', [
        'nonce' => 'sink-nonce-bribe-1',
    ]);

    assertCheck(
        $launderOut['ok'] === true
        && $launderOut['sink']['effect']['previousHeat'] === 78
        && $launderOut['sink']['effect']['newHeat'] === 43,
        'launder_heat drops North Harbor police heat by 35 pts (78 -> 43)'
    );
    assertCheck(
        $honeOut['ok'] === true
        && $honeOut['hudState']['weaponPrecisionBonusBps'] === 600
        && $honeOut['sink']['effect']['durationSec'] === 7200,
        'hone_weapon grants +6% (600 bps) precision edge for 2 hours (7200s)'
    );
    assertCheck(
        $bribeOut['ok'] === true
        && $bribeOut['sink']['effect']['jailSecondsReduced'] >= 599
        && $bribeOut['sink']['effect']['hospitalSecondsReduced'] >= 899,
        'bribe_wardens cuts active jail & hospital recovery timers by 50%'
    );

    $totalSunk = $launderOut['sink']['costCash'] + $honeOut['sink']['costCash'] + $bribeOut['sink']['costCash'];
    // Add matching crime faucet so 24h ratio lands squarely inside 1.08 - 1.15 healthy equilibrium band
    $targetTotalFaucets = (int) round($totalSunk * 1.12);
    $additionalFaucet = max(0, $targetTotalFaucets - 3_600);
    if ($additionalFaucet > 0) {
        $ledger->record('1001', 'cash', $additionalFaucet, 25_000, 'mission.claim', bin2hex(random_bytes(16)));
    }

    $hud = $service->getEconomyHudState(1001);
    $playerEq = $hud['equilibrium']['player'];
    assertCheck(
        $playerEq['sinks24h'] === $totalSunk
        && $playerEq['faucets24h'] === $targetTotalFaucets
        && $playerEq['inHealthyBand'] === true
        && $playerEq['faucetSinkRatio'] >= 1.08
        && $playerEq['faucetSinkRatio'] <= 1.15,
        "24h ledger equilibrium excludes bank.deposit and tracks live 1.08-1.15 ratio ({$playerEq['faucetSinkRatio']})"
    );
    assertCheck(
        count($hud['radar']['districts']) === 6 && isset($hud['radar']['nextObjective']['route']),
        'HUD state exposes all 6 Zone City districts with threat tiers and Next Objective waypoint'
    );

    // -------------------------------------------------------------------------
    // 4. Replay-Nonce Rejection & Per-Player Isolation
    // -------------------------------------------------------------------------
    $simulatedNowMs += 1_000;
    $firstEnv = $service->validateActionEnvelope(1001, 'crime.attempt', 'unique-nonce-v155-77', ['quantity' => 1]);
    $simulatedNowMs += 300;
    $replayEnv = $service->validateActionEnvelope(1001, 'crime.attempt', 'unique-nonce-v155-77', ['quantity' => 1]);
    $otherPlayerEnv = $service->validateActionEnvelope('founder-player', 'crime.attempt', 'unique-nonce-v155-77', ['quantity' => 1]);

    assertCheck($firstEnv['valid'] === true, 'fresh cryptographic action nonce is accepted');
    assertCheck(
        $replayEnv['valid'] === false
        && $replayEnv['reasonCode'] === 'REPLAY_NONCE'
        && in_array('replay_nonce', $replayEnv['flags'], true),
        'duplicate replay nonce for same player is rejected with REPLAY_NONCE'
    );
    assertCheck(
        $otherPlayerEnv['valid'] === true,
        'nonce namespace is isolated per player without cross-account collision'
    );

    // -------------------------------------------------------------------------
    // 5. Sub-Human Macro Burst Detection (< 110ms across >= 6 mutations)
    //    vs Normal Rapid Human Clicks (Zero False Positives!)
    // -------------------------------------------------------------------------
    $simulatedNowMs += 10_000;
    // A) Human double/triple/quadruple rapid click (4 mutations at 75ms apart) -> MUST NOT false-flag!
    $humanShortBurstOk = true;
    for ($i = 0; $i < 4; $i++) {
        $simulatedNowMs += 75;
        $res = $service->validateActionEnvelope('founder-player', 'gym.train', 'human-fast-' . $i, ['sessions' => 1]);
        if (!$res['valid']) {
            $humanShortBurstOk = false;
        }
    }
    assertCheck($humanShortBurstOk, 'normal human 4-click rapid burst (< 6 mutations) is NOT false-flagged');

    // B) Sustained human rapid clicking (8 clicks at 145ms apart, >= 110ms) -> MUST NOT false-flag!
    $simulatedNowMs += 10_000;
    $humanSustainedOk = true;
    for ($i = 0; $i < 8; $i++) {
        $simulatedNowMs += 145;
        $res = $service->validateActionEnvelope('founder-player', 'crime.attempt', 'human-steady-' . $i, ['quantity' => 1]);
        if (!$res['valid']) {
            $humanSustainedOk = false;
        }
    }
    assertCheck($humanSustainedOk, 'normal rapid human clicking at 145ms cadence across 8 actions is NOT false-flagged');

    // C) Sub-human automated macro bot (6 mutations at 65ms intervals: < 110ms sustained across >= 6 mutations)
    $simulatedNowMs += 10_000;
    $macroCaughtAt6 = false;
    $firstFiveAllowed = true;
    for ($i = 1; $i <= 6; $i++) {
        $simulatedNowMs += 65;
        $res = $service->validateActionEnvelope(1001, 'crime.attempt', 'bot-macro-' . $i, ['quantity' => 1]);
        if ($i < 6 && !$res['valid']) {
            $firstFiveAllowed = false;
        }
        if ($i === 6 && !$res['valid'] && $res['reasonCode'] === 'MACRO_CADENCE_BURST') {
            $macroCaughtAt6 = true;
        }
    }
    assertCheck(
        $firstFiveAllowed && $macroCaughtAt6,
        'sustained 65ms sub-human macro burst is caught deterministically on 6th mutation (MACRO_CADENCE_BURST)'
    );

    // -------------------------------------------------------------------------
    // 6. Tampered Negative / NaN / Infinity / Fractional Quantities
    // -------------------------------------------------------------------------
    $simulatedNowMs += 10_000;
    $negCheck = $service->validateActionEnvelope(1001, 'market.buy', 'tamper-neg', ['quantity' => -5]);
    $nanCheck = $service->validateActionEnvelope(1001, 'casino.bet', 'tamper-nan', ['bet' => NAN]);
    $strNanCheck = $service->validateActionEnvelope(1001, 'bank.deposit', 'tamper-strnan', ['amount' => 'NaN']);
    $fracCheck = $service->validateActionEnvelope(1001, 'market.buy', 'tamper-frac', ['quantity' => 2.5]);

    assertCheck(
        !$negCheck['valid'] && $negCheck['reasonCode'] === 'TAMPERED_QUANTITY'
        && !$nanCheck['valid'] && $nanCheck['reasonCode'] === 'TAMPERED_QUANTITY'
        && !$strNanCheck['valid'] && $strNanCheck['reasonCode'] === 'TAMPERED_QUANTITY'
        && !$fracCheck['valid'] && $fracCheck['reasonCode'] === 'TAMPERED_QUANTITY',
        'negative, float NAN, string "NaN", and fractional quantities are blocked with TAMPERED_QUANTITY'
    );

    $auditEvents = $service->recentSecurityAuditEvents(1001, 20);
    $flagTypes = array_column($auditEvents, 'flagType');
    assertCheck(
        in_array('replay_nonce', $flagTypes, true)
        && in_array('macro_cadence_burst', $flagTypes, true)
        && in_array('tampered_quantity', $flagTypes, true),
        'security_audit_events cleanly records replay_nonce, macro_cadence_burst, and tampered_quantity flags'
    );

    // -------------------------------------------------------------------------
    // 7. Unified Dispatcher (`act`) & Dual SQL Law Verification (PG16 + SQLite)
    // -------------------------------------------------------------------------
    $dispatchedHud = $service->act(1001, 'economy.hud_state');
    assertCheck(
        ($dispatchedHud['ok'] ?? false) === true && isset($dispatchedHud['equilibrium']['global']['faucetSinkRatio']),
        'unified act() dispatcher handles economy.hud_state cleanly'
    );

    $service->ensureSchema(); // second call must be 100% idempotent
    $sourceCode = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/EconomyAntiCheatService.php');

    // Extract SQL statements (SELECT / INSERT / UPDATE / DELETE / CREATE TABLE / CREATE INDEX)
    preg_match_all(
        '/[\'"]((?:\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|CREATE\s+INDEX)\b)[^\'"]*)[\'"]/is',
        $sourceCode,
        $sqlMatches
    );
    $sqlStatements = $sqlMatches[1] ?? [];
    $hasTwoArgSqlMaxMin = false;
    $hasDuplicateNamedParams = false;
    foreach ($sqlStatements as $sqlStmt) {
        if (preg_match('/\b(?:MAX|MIN)\s*\([^,)]+,[^)]+\)/i', $sqlStmt) === 1) {
            $hasTwoArgSqlMaxMin = true;
        }
        if (preg_match_all('/:[a-zA-Z_][a-zA-Z0-9_]*/', $sqlStmt, $paramMatches) > 0) {
            $params = $paramMatches[0];
            if (count($params) !== count(array_unique($params))) {
                $hasDuplicateNamedParams = true;
            }
        }
    }

    assertCheck(
        count($sqlStatements) >= 10
        && !$hasTwoArgSqlMaxMin
        && !$hasDuplicateNamedParams
        && str_contains($sourceCode, 'CASE WHEN')
        && str_contains($sourceCode, 'CREATE TABLE IF NOT EXISTS'),
        'all SQL statements obey PostgreSQL 16 + SQLite Dual Law (CASE WHEN, zero 2-arg SQL MAX/MIN, unique named PDO params, CREATE TABLE IF NOT EXISTS)'
    );
} finally {
    foreach (['', '-wal', '-shm'] as $suffix) {
        $f = $databasePath . $suffix;
        if (is_file($f)) {
            @unlink($f);
        }
    }
}

fwrite(STDOUT, "\nSummary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);

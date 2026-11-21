<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CooldownException;
use Zone\Engine\Core\Game\FactionTerritoryWarService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-faction-war-' . bin2hex(random_bytes(6)) . '.sqlite';
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
        class_exists(\Zone\Engine\Core\Game\FactionTerritoryWarService::class)
        && class_exists(\Zone\Core\Game\FactionTerritoryWarService::class),
        'Both Zone\\Engine\\Core\\Game and Zone\\Core\\Game FactionTerritoryWarService namespaces autoload cleanly',
    );

    // =========================================================================
    // 1. ELO Rating Calculation (K=32) & Lag-Compensated Chain Window Math
    // =========================================================================
    $evenWin = FactionTerritoryWarService::computeEloDelta(1200, 1200, 1.0, 32);
    check(
        $evenWin['deltaA'] === 16 && $evenWin['deltaB'] === -16 && $evenWin['nextRatingA'] === 1216,
        'Equal-ELO win computes +16 / -16 symmetric delta with K=32',
    );

    $upsetWin = FactionTerritoryWarService::computeEloDelta(1100, 1300, 1.0, 32);
    check(
        $upsetWin['deltaA'] >= 22 && $upsetWin['deltaA'] <= 26,
        'Underdog ELO upset yields higher gain (+24 expected)',
    );

    $serverNow = 1_700_000_300.20;
    $chainExpiresAt = 1_700_000_300;
    $lagActive = FactionTerritoryWarService::evaluateLagCompensatedChainWindow($serverNow, $chainExpiresAt, 1_700_000_299.95, 0.35);
    $lagExpired = FactionTerritoryWarService::evaluateLagCompensatedChainWindow($serverNow + 0.50, $chainExpiresAt, 1_700_000_299.95, 0.35);
    check(
        $lagActive['active'] === true && $lagActive['compensated'] === true && $lagExpired['active'] === false,
        'Lag-compensated chain window honors <=0.35s RTT rewind and rejects hits past max rewind',
    );

    // =========================================================================
    // 2. Database Integration: 6-District Map, Delta Sync, 3-Slot Raid Lobby, Cooldowns & ELO
    // =========================================================================
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);

    $virtualClock = 1_700_000_000.0;
    $warService = new FactionTerritoryWarService(
        $database,
        $events,
        static fn (int $min, int $max): int => (int) round(($min + $max) / 2),
        static function () use (&$virtualClock): float {
            return $virtualClock;
        },
    );

    // Seed founder-player with enough energy
    $database->execute("UPDATE players SET energy = 120, max_energy = 150 WHERE id = 'founder-player'");

    // Full initial snapshot
    $snap1 = $warService->snapshot('founder-player');
    check(
        $snap1['ok'] === true
        && count($snap1['districts']) === 6
        && $snap1['deltaCompressed'] === false
        && count($snap1['eloStandings']) === 4,
        'Initial snapshot returns all 6 Zone City districts and 4 ELO-rated syndicates',
    );

    // Delta snapshot when nothing changed should return empty changed slices
    $baseSeq = (int) $snap1['snapshotSeq'];
    $deltaEmpty = $warService->snapshot('founder-player', $baseSeq);
    check(
        $deltaEmpty['deltaCompressed'] === true
        && count($deltaEmpty['districts']) === 0
        && count($deltaEmpty['lobbies']) === 0,
        'Delta-compressed snapshot at current seq transmits zero redundant unchanged districts',
    );

    // ELO Matchmaking
    $matchRes = $warService->act('founder-player', 'faction_war.matchmake');
    check(
        $matchRes['ok'] === true
        && $matchRes['match']['factionId'] === 'vipers'
        && $matchRes['match']['opponentFactionId'] !== 'vipers'
        && $matchRes['match']['kFactor'] === 32,
        'ELO matchmaker pairs player faction with eligible rival syndicate',
    );

    // 3-Slot Raid Lobby creation + joining
    $lobbyCreate = $warService->createRaidLobby('founder-player', [
        'district' => 'fin',
        'slot' => 'vanguard',
    ]);
    $lobbyId = (string) $lobbyCreate['lobby']['lobbyId'];
    check(
        $lobbyCreate['ok'] === true
        && $lobbyCreate['lobby']['filledSlots'] === 1
        && $lobbyCreate['lobby']['maxSlots'] === 3
        && $lobbyCreate['lobby']['status'] === 'WAITING',
        'Create 3-Slot Raid Lobby initializes WAITING state with 1/3 slots occupied',
    );

    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['ally-1', 'CipherAlly', 10, 2200, 15000, 100, 45, 900, 500, 100, 45, 900, 500, gmdate('c'), 200, 200, 200, 200, 0, 'Zone City', 1, gmdate('Y-m-d')],
    );
    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['42', 'NumericRaider', 9, 1800, 12000, 100, 45, 900, 500, 100, 45, 900, 500, gmdate('c'), 180, 180, 180, 180, 0, 'Zone City', 1, gmdate('Y-m-d')],
    );

    $join2 = $warService->joinRaidLobby('ally-1', ['lobbyId' => $lobbyId, 'slot' => 'breacher']);
    $join3 = $warService->joinRaidLobby(42, ['lobbyId' => $lobbyId, 'slot' => 'support']);
    check(
        $join2['lobby']['filledSlots'] === 2
        && $join3['lobby']['filledSlots'] === 3
        && $join3['lobby']['status'] === 'READY',
        '3-Slot Raid Lobby transitions to READY once all 3 slots (including int playerId 42) are filled',
    );

    // Assault sector with server-authoritative energy + cooldown gate + spoofed payload resistance
    $energyBefore = (int) $database->fetchOne("SELECT energy FROM players WHERE id = 'founder-player'")['energy'];
    $assaultRes = $warService->act('founder-player', 'assault_sector', [
        'district' => 'fin',
        'lobbyId' => $lobbyId,
        'cashAwarded' => 9999999,
        'influenceShift' => 99,
    ]);
    check(
        $assaultRes['ok'] === true
        && $assaultRes['result']['energySpent'] === FactionTerritoryWarService::ASSAULT_ENERGY_COST
        && (int) $assaultRes['player']['energy'] === ($energyBefore - FactionTerritoryWarService::ASSAULT_ENERGY_COST)
        && $assaultRes['result']['cashAwarded'] < 100000
        && $assaultRes['result']['chainCount'] === 1,
        'Assault sector deducts 15E, ignores spoofed client numbers, and starts 5m chain window',
    );

    // Rapid assault repeat blocked by 8s server cooldown
    $assaultCdBlocked = false;
    try {
        $warService->assaultSector('founder-player', ['district' => 'fin']);
    } catch (CooldownException $cdEx) {
        $assaultCdBlocked = $cdEx->retryAfter > 0;
    }
    check($assaultCdBlocked, 'Server cooldown gate blocks rapid assault_sector spam');

    // Delta snapshot since $baseSeq only includes mutated district ('fin') & lobby, not all 6
    $deltaAfter = $warService->snapshot('founder-player', $baseSeq);
    check(
        $deltaAfter['deltaCompressed'] === true
        && count($deltaAfter['districts']) === 1
        && $deltaAfter['districts'][0]['id'] === 'fin'
        && count($deltaAfter['lobbies']) === 1,
        'Delta-compressed snapshot sends only the changed district (1/6) and changed lobby',
    );

    // Fortify sector + cooldown gate
    $fortRes = $warService->fortifySector('founder-player', ['district' => 'center']);
    check(
        $fortRes['ok'] === true
        && $fortRes['result']['energySpent'] === FactionTerritoryWarService::FORTIFY_ENERGY_COST
        && $fortRes['district']['fortifyShield'] > 24,
        'Fortify sector deducts 10E and raises district fortifyShield',
    );

    $fortCdBlocked = false;
    try {
        $warService->fortifySector('founder-player', ['district' => 'center']);
    } catch (CooldownException) {
        $fortCdBlocked = true;
    }
    check($fortCdBlocked, 'Server cooldown gate blocks rapid fortify_sector spam');

    // Insufficient energy gate
    $virtualClock += 12.0;
    $database->execute("UPDATE players SET energy = 4 WHERE id = 'founder-player'");
    $lowEnergyBlocked = false;
    try {
        $warService->assaultSector('founder-player', ['district' => 'fin']);
    } catch (RuntimeException $e) {
        $lowEnergyBlocked = str_contains($e->getMessage(), 'Insufficient Energy');
    }
    check($lowEnergyBlocked, 'Server-authoritative energy gate rejects assault when player energy < 15E');

    // Resolve raid match -> updates ELO ratings & marks lobby RESOLVED
    $resolveRes = $warService->resolveMatch('founder-player', ['lobbyId' => $lobbyId]);
    check(
        $resolveRes['ok'] === true
        && $resolveRes['lobby']['status'] === 'RESOLVED'
        && isset($resolveRes['result']['eloUpdate']['deltaA']),
        'resolveMatch settles raid lobby and persists K=32 ELO rating updates',
    );

    // Ledger audit
    $ledgerEntries = $database->fetchAll(
        "SELECT reason, amount FROM economy_ledger WHERE player_id = 'founder-player' AND reason LIKE 'faction_war.%'"
    );
    check(count($ledgerEntries) >= 3, 'Faction war assault, fortify, & match payouts write auditable economy_ledger rows');

    // Static SQL Dual-Law Audit (strip comments first)
    $serviceSource = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/FactionTerritoryWarService.php');
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

fwrite(STDOUT, "\nFactionTerritoryWarTest Summary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);

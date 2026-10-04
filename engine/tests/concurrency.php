<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Game\CooldownException;
use Zone\Engine\Core\Game\CooldownService;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Publishing\ReleaseManager;

// Child processes construct their engine before the parent takes a lock, so
// these checks exercise action locking rather than schema initialization.
if (($argv[1] ?? '') === '--worker') {
    $engine = zone_engine('sqlite:' . $argv[2]);
    echo "READY\n";
    fflush(STDOUT);
    fgets(STDIN);
    echo "ATTEMPTING\n";
    fflush(STDOUT);
    try {
        $action = $argv[3];
        $result = match (true) {
            $action === 'bank' => $engine->bankDeposit(200),
            $action === 'publish' => $engine->publishRelease('concurrency-child'),
            str_starts_with($action, 'activate:') => $engine->activateRelease(substr($action, 9), 'concurrency-child'),
            default => $engine->playBlackjack(100),
        };
        echo json_encode(['status' => 'ok', 'player' => $result['player'] ?? null, 'releaseId' => $result['id'] ?? null, 'version' => $result['version'] ?? null], JSON_THROW_ON_ERROR) . "\n";
    } catch (CooldownException) {
        echo "{\"status\":\"cooldown\"}\n";
    } catch (Throwable $exception) {
        echo json_encode(['status' => 'error', 'error' => $exception->getMessage()], JSON_THROW_ON_ERROR) . "\n";
    }
    exit;
}

$databasePath = dirname(__DIR__) . '/var/concurrency-' . bin2hex(random_bytes(6)) . '.sqlite';
$passed = 0;
$failed = 0;
$database = null;
$worker = null;
$pipes = [];

function concurrencyCheck(bool $condition, string $message): void
{
    global $passed, $failed;
    $condition ? $passed++ : $failed++;
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $message . "\n";
}

function startWorker(string $databasePath, string $action): array
{
    $pipes = [];
    $worker = proc_open([PHP_BINARY, __FILE__, '--worker', $databasePath, $action], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes);
    if (!is_resource($worker)) {
        throw new RuntimeException('Unable to start concurrency test worker.');
    }
    stream_set_timeout($pipes[1], 10);
    if (trim((string) fgets($pipes[1])) !== 'READY') {
        throw new RuntimeException('Concurrency worker did not become ready.');
    }
    return [$worker, $pipes];
}

function releaseWorker(array $pipes): void
{
    fwrite($pipes[0], "GO\n");
    fflush($pipes[0]);
    if (trim((string) fgets($pipes[1])) !== 'ATTEMPTING') {
        throw new RuntimeException('Concurrency worker did not start the action.');
    }
    usleep(150000);
}

function finishWorker($worker, array $pipes): array
{
    $result = json_decode((string) fgets($pipes[1]), true, 512, JSON_THROW_ON_ERROR);
    foreach ($pipes as $pipe) {
        fclose($pipe);
    }
    proc_close($worker);
    return $result;
}

try {
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $database->execute("UPDATE players SET cash = 1000, bank_balance = 0 WHERE id = 'founder-player'");
    [$worker, $pipes] = startWorker($databasePath, 'bank');
    $blocked = false;
    $database->playerTransaction('founder-player', function () use ($database, $worker, $pipes, &$blocked): void {
        releaseWorker($pipes);
        $blocked = proc_get_status($worker)['running'];
        // Simulate another action awarding cash while this player's lock is held.
        $database->execute("UPDATE players SET cash = cash + 100 WHERE id = 'founder-player'");
    });
    $bankResult = finishWorker($worker, $pipes);
    $worker = null;
    $pipes = [];
    concurrencyCheck($blocked && ($bankResult['status'] ?? '') === 'ok', 'concurrent bank action waits for the player lock and then succeeds');
    concurrencyCheck(($bankResult['player']['cash'] ?? null) === 900 && ($bankResult['player']['bank_balance'] ?? null) === 200, 'bank reads the committed reward and preserves total wealth under interleaving');

    [$worker, $pipes] = startWorker($databasePath, 'blackjack');
    $database->playerTransaction('founder-player', function () use ($database, $pipes): void {
        releaseWorker($pipes);
        (new CooldownService($database))->arm('founder-player', 'blackjack', 30);
    });
    $casinoResult = finishWorker($worker, $pipes);
    $worker = null;
    $pipes = [];
    concurrencyCheck(($casinoResult['status'] ?? '') === 'cooldown', 'concurrent casino request checks the cooldown after acquiring the player lock');
    $player = $database->fetchOne("SELECT cash, bank_balance FROM players WHERE id = 'founder-player'");
    concurrencyCheck((int) $player['cash'] === 900 && (int) $player['bank_balance'] === 200, 'a cooldown committed by another request prevents casino wallet mutation');

    $database->playerTransaction('founder-player', function () use ($database): void {
        $database->execute("UPDATE players SET cash = cash + 10 WHERE id = 'founder-player'");
        try {
            $database->playerTransaction('founder-player', function () use ($database): void {
                $database->execute("UPDATE players SET cash = cash + 500 WHERE id = 'founder-player'");
                throw new RuntimeException('nested rollback proof');
            });
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() !== 'nested rollback proof') {
                throw $exception;
            }
        }
    });
    concurrencyCheck((int) $database->fetchOne("SELECT cash FROM players WHERE id = 'founder-player'")['cash'] === 910, 'nested player transaction rolls back its savepoint without discarding the outer transaction');

    $engine = zone_engine('sqlite:' . $databasePath);
    $releases = new ReleaseManager($database, new EventBus($database));
    [$worker, $pipes] = startWorker($databasePath, 'publish');
    $first = null;
    // Use this connection's ReleaseManager under its own config lock; the child
    // must wait before reading MAX(version), not merely before its final write.
    $releases->configurationTransaction(function () use ($releases, $pipes, &$first): void {
        releaseWorker($pipes);
        $first = $releases->publish('concurrency-parent');
    });
    $published = finishWorker($worker, $pipes); $worker = null; $pipes = [];
    concurrencyCheck(($published['status'] ?? '') === 'ok' && $published['version'] === $first['version'] + 1, 'concurrent publication reads the committed version after the configuration lock');
    concurrencyCheck(count($database->fetchAll('SELECT id FROM content_releases WHERE active = 1')) === 1, 'concurrent publication leaves exactly one active release');
    [$worker, $pipes] = startWorker($databasePath, 'activate:' . $first['id']);
    $releases->configurationTransaction(function () use ($releases, $pipes, $published): void {
        releaseWorker($pipes);
        $releases->activate($published['releaseId'], 'concurrency-parent');
    });
    $activated = finishWorker($worker, $pipes); $worker = null; $pipes = [];
    $active = $database->fetchAll('SELECT id FROM content_releases WHERE active = 1');
    concurrencyCheck(($activated['status'] ?? '') === 'ok' && count($active) === 1 && $active[0]['id'] === $first['id'], 'concurrent rollback serializes activation and leaves one unambiguous active release');
} catch (Throwable $exception) {
    $failed++;
    fwrite(STDERR, 'FAIL: ' . $exception::class . ': ' . $exception->getMessage() . "\n");
} finally {
    foreach ($pipes as $pipe) {
        if (is_resource($pipe)) {
            fclose($pipe);
        }
    }
    if (is_resource($worker)) {
        proc_terminate($worker);
        proc_close($worker);
    }
    $database = null;
    foreach (glob($databasePath . '*') ?: [] as $file) {
        @unlink($file);
    }
}

echo "\nCONCURRENCY RESULT: {$passed} passed, {$failed} failed\n";
exit($failed === 0 ? 0 : 1);

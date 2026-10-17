<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Game\WorldDirector;
use Zone\Engine\Core\Media\AssetLibrary;
use Zone\Engine\Core\Media\SafeBundle;
use Zone\Engine\Core\Persistence\Database;

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$options = getopt('', ['once', 'role:', 'id:', 'max-seconds:', 'interval-ms:', 'stop-file:']);
$role = $options['role'] ?? 'all';
if (!in_array($role, ['studio', 'world', 'all'], true)) throw new InvalidArgumentException('Worker role must be studio, world, or all.');
$workerId = $options['id'] ?? 'zone-' . $role;
if (!is_string($workerId) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $workerId)) throw new InvalidArgumentException('Worker identifier is invalid.');
$databaseUrl = getenv('ZONE_DATABASE_URL') ?: getenv('DATABASE_URL') ?: getenv('POSTGRES_URL');
if (!is_string($databaseUrl) || $databaseUrl === '') throw new RuntimeException('Worker requires an explicit ZONE_DATABASE_URL; it never guesses a production database.');
$interval = isset($options['interval-ms']) && ctype_digit((string) $options['interval-ms']) ? (int) $options['interval-ms'] : 1000;
if ($interval < 250 || $interval > 10000) throw new InvalidArgumentException('Worker poll interval must be 250 to 10000 milliseconds.');
$maxSeconds = isset($options['max-seconds']) && ctype_digit((string) $options['max-seconds']) ? (int) $options['max-seconds'] : 0;
$root = rtrim(getenv('ZONE_ASSET_ROOT') ?: ZONE_ENGINE_ROOT . '/var/assets', '/\\');
SafeBundle::directory($root . '/heartbeats');
$stopFile = $options['stop-file'] ?? $root . '/heartbeats/' . $workerId . '.stop';
$lockPath = $root . '/heartbeats/' . $workerId . '.lock';
if (is_link($lockPath)) throw new RuntimeException('Worker lock must not be a link.');
$lock = fopen($lockPath, 'c+b');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('A worker with this identity already owns the loop.');
ftruncate($lock, 0); fwrite($lock, (string) getmypid()); fflush($lock);
$db = Database::connect($databaseUrl); $db->migrateAndSeed();
$assets = new AssetLibrary($db, $root);
$world = class_exists(WorldDirector::class) ? new WorldDirector($db) : null;
if ($role === 'world' && $world === null) throw new RuntimeException('World director is not installed.');
$started = microtime(true); $lastHeartbeat = 0; $cycles = 0; $consecutiveErrors = 0;
$log = static function (array $entry): void { echo json_encode(['at' => gmdate('c'), ...$entry], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL; };
$log(['worker' => $workerId, 'event' => 'started', 'role' => $role, 'pid' => getmypid(), 'engine' => 'deterministic-authoritative-worker']);
try {
    do {
        if (is_file($stopFile)) break;
        try {
            if (time() - $lastHeartbeat >= 5) {
                $assets->heartbeat($workerId, ['role' => $role, 'pid' => getmypid(), 'status' => 'running', 'cycles' => $cycles, 'engine' => 'deterministic-authoritative-worker']);
                $lastHeartbeat = time();
            }
            $inspected = $role !== 'world' ? $assets->runPending(1) : ['processed' => 0, 'jobs' => []];
            $tick = $role !== 'studio' && $world !== null ? $world->tick() : ['status' => 'not-requested'];
            $cycles++; $consecutiveErrors = 0;
            if ($inspected['processed'] > 0 || ($tick['status'] ?? '') === 'ticked' || isset($options['once'])) $log(['worker' => $workerId, 'event' => 'cycle', 'assets' => $inspected, 'world' => $tick]);
        } catch (Throwable $error) {
            $consecutiveErrors++;
            // No URLs, credentials, SQL payloads or player data in worker stdout.
            $log(['worker' => $workerId, 'event' => 'error', 'class' => $error::class, 'retry' => $consecutiveErrors, 'message' => 'Worker cycle failed; inspect the local service log.']);
            if (isset($options['once']) || $consecutiveErrors >= 10) throw $error;
        }
        if (isset($options['once']) || ($maxSeconds > 0 && microtime(true) - $started >= $maxSeconds)) break;
        usleep(min(10000, $interval * max(1, $consecutiveErrors)) * 1000);
    } while (true);
} finally {
    try { $assets->heartbeat($workerId, ['role' => $role, 'pid' => getmypid(), 'status' => 'stopped', 'cycles' => $cycles]); } catch (Throwable) { /* DB outage must not strand the process lock. */ }
    flock($lock, LOCK_UN); fclose($lock);
}
$log(['worker' => $workerId, 'event' => 'stopped', 'cycles' => $cycles]);

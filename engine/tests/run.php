<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Themes\ThemeRegistry;
use Zone\Engine\Infrastructure\Cache\ArrayCacheStore;

$databasePath = dirname(__DIR__) . '/var/test-' . bin2hex(random_bytes(6)) . '.sqlite';
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

function build_engine(string $databasePath): array
{
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);
    $modules = new ModuleRegistry($database, $events, dirname(__DIR__) . '/modules');
    $themes = new ThemeRegistry($database, dirname(__DIR__) . '/themes');
    $modules->discoverAndBoot();
    $themes->discover();
    return [new GameEngine($database, $events, $modules, $themes, new ArrayCacheStore()), $database];
}

try {
    [$engine, $database] = build_engine($databasePath);
    $status = $engine->status();
    check(version_compare(PHP_VERSION, '8.5.0', '>='), 'runtime is PHP 8.5 or newer');
    check($status['serverAuthoritative'] === true, 'engine reports server-authoritative execution');
    check($status['database'] === 'sqlite', 'presentation adapter is SQLite');
    check($status['cacheAdapter'] === 'memory' && $status['redisPortReady'] === true, 'cache port runs in memory and exposes a Redis production adapter');
    check(count($engine->modules()) === 2, 'two independent modules discovered from manifests');
    check(count($engine->themes()) === 2, 'two independent themes discovered from manifests');
    check(count($engine->crimes()) === 3, 'Crime module exposes its catalog');

    $engine->changeModule('achievements', 'disable');
    [$engine, $database] = build_engine($databasePath);
    $database->execute('UPDATE crimes SET success_basis_points = 10000 WHERE id = :id', ['id' => 'pickpocket']);
    $first = $engine->attemptCrime('pickpocket');
    check($first['success'] === true, 'crime outcome is calculated by the PHP engine');
    check($first['serverProof']['clientSuppliedOutcomeFields'] === 0, 'client cannot supply outcome or reward fields');
    check(count($engine->ledger()) === 1, 'successful reward creates one economy ledger entry');
    check(count($engine->achievements()) === 0, 'disabled Achievement module does not react');

    $engine->changeModule('achievements', 'enable');
    [$engine, $database] = build_engine($databasePath);
    $database->execute('UPDATE crimes SET success_basis_points = 10000 WHERE id = :id', ['id' => 'pickpocket']);
    $second = $engine->attemptCrime('pickpocket');
    check($second['success'] === true, 'second server-authoritative crime succeeds under controlled test odds');
    check(count($engine->achievements()) === 1, 'enabled Achievement module reacts through CrimeSucceeded hook');
    $eventNames = array_column($engine->eventLog(), 'event_name');
    check(in_array('CrimeSucceeded', $eventNames, true), 'CrimeSucceeded event is persisted');
    check(in_array('AchievementUnlocked', $eventNames, true), 'subscriber publishes AchievementUnlocked without core edits');

    $engine->changeModule('crime', 'uninstall');
    [$engine] = build_engine($databasePath);
    check($engine->crimes() === [], 'uninstalled Crime module removes its API capability');
    $blocked = false;
    try {
        $engine->attemptCrime('pickpocket');
    } catch (RuntimeException) {
        $blocked = true;
    }
    check($blocked, 'disabled module action is rejected by the engine');
    $engine->changeModule('crime', 'install');

    $activated = $engine->activateTheme('terminal');
    check($activated['active'] === true, 'theme activates without changing gameplay code');
    check(str_contains($engine->activeThemeStylesheet(), '#42e8e0'), 'active theme stylesheet is resolved from its package');

    $schema = (string) file_get_contents(dirname(__DIR__) . '/database/schema.postgresql.sql');
    foreach (['economy_ledger', 'event_log', 'jobs', 'notifications', 'assets'] as $table) {
        check(str_contains($schema, "CREATE TABLE IF NOT EXISTS {$table}"), "PostgreSQL schema contains {$table}");
    }
} catch (Throwable $exception) {
    $failed++;
    fwrite(STDERR, 'FATAL: ' . $exception::class . ': ' . $exception->getMessage() . "\n" . $exception->getTraceAsString() . "\n");
} finally {
    foreach (glob($databasePath . '*') ?: [] as $file) {
        @unlink($file);
    }
}

fwrite(STDOUT, "\nRESULT: {$passed} passed, {$failed} failed\n");
exit($failed === 0 ? 0 : 1);

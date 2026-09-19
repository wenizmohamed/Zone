<?php

declare(strict_types=1);

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Themes\ThemeRegistry;
use Zone\Engine\Infrastructure\Cache\CacheFactory;

const ZONE_ENGINE_ROOT = __DIR__;
const ZONE_REPOSITORY_ROOT = __DIR__ . '/..';

spl_autoload_register(static function (string $class): void {
    $prefixes = [
        'Zone\\Engine\\' => ZONE_ENGINE_ROOT . '/src/',
        'Zone\\Modules\\' => ZONE_ENGINE_ROOT . '/modules/',
    ];

    foreach ($prefixes as $prefix => $directory) {
        if (!str_starts_with($class, $prefix)) {
            continue;
        }

        $relative = substr($class, strlen($prefix));
        $path = $directory . str_replace('\\', '/', $relative) . '.php';
        if (is_file($path)) {
            require $path;
        }
    }
});

function zone_engine(?string $databaseUrl = null): GameEngine
{
    $resolvedDatabaseUrl = $databaseUrl
        ?? getenv('ZONE_DATABASE_URL')
        ?: getenv('DATABASE_URL')
        ?: getenv('POSTGRES_URL')
        ?: null;

    if (getenv('VERCEL') === '1' && $resolvedDatabaseUrl === null) {
        throw new RuntimeException('Production database is not configured. Connect PostgreSQL and provide DATABASE_URL.');
    }

    $database = Database::connect($resolvedDatabaseUrl);
    $database->migrateAndSeed();

    $events = new EventBus($database);
    $modules = new ModuleRegistry($database, $events, ZONE_ENGINE_ROOT . '/modules');
    $themes = new ThemeRegistry($database, ZONE_ENGINE_ROOT . '/themes');
    $releases = new ReleaseManager($database, $events);
    $modules->discoverAndBoot();
    $themes->discover();

    return new GameEngine($database, $events, $modules, $themes, $releases, CacheFactory::fromEnvironment());
}

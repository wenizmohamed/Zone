<?php

declare(strict_types=1);

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
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
    $database = Database::connect($databaseUrl ?? getenv('ZONE_DATABASE_URL') ?: null);
    $database->migrateAndSeed();

    $events = new EventBus($database);
    $modules = new ModuleRegistry($database, $events, ZONE_ENGINE_ROOT . '/modules');
    $themes = new ThemeRegistry($database, ZONE_ENGINE_ROOT . '/themes');
    $modules->discoverAndBoot();
    $themes->discover();

    return new GameEngine($database, $events, $modules, $themes, CacheFactory::fromEnvironment());
}

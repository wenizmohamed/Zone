<?php

declare(strict_types=1);

namespace Zone\Modules\Crime;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class CrimeModule implements GameModule
{
    public function boot(EventBus $events, Database $database): void
    {
        // Crime execution is exposed by the application service only while this module is enabled.
        // Other modules react through domain events and never modify this module.
    }

    public static function enabledCrimeCount(Database $database): int
    {
        return (int) (($database->fetchOne('SELECT COUNT(*) AS count FROM crimes WHERE enabled = 1')['count'] ?? 0));
    }
}

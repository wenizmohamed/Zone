<?php

declare(strict_types=1);

namespace Zone\Modules\Gangs;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Gangs / Factions module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: gangs" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class GangsModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: gangs';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function factionCount(Database $database): int
    {
        return (int) (($database->fetchOne('SELECT COUNT(*) AS count FROM factions')['count'] ?? 0));
    }
}

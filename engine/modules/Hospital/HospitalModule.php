<?php

declare(strict_types=1);

namespace Zone\Modules\Hospital;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Hospital module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: hospital" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class HospitalModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: hospital';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function injuredPlayerCount(Database $database): int
    {
        return (int) (($database->fetchOne('SELECT COUNT(*) AS count FROM players WHERE life < max_life')['count'] ?? 0));
    }
}

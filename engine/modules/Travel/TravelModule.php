<?php

declare(strict_types=1);

namespace Zone\Modules\Travel;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Travel & Cities module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: travel" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class TravelModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: travel';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function activeTravelerCount(Database $database): int
    {
        return (int) (($database->fetchOne("SELECT COUNT(*) AS count FROM player_travel WHERE status = 'traveling'")['count'] ?? 0));
    }
}

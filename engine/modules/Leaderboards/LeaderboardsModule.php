<?php

declare(strict_types=1);

namespace Zone\Modules\Leaderboards;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Leaderboards module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: leaderboards" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class LeaderboardsModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: leaderboards';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }
}

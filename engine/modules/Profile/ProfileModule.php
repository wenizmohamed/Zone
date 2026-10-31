<?php

declare(strict_types=1);

namespace Zone\Modules\Profile;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Player Profile module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: profile" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class ProfileModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: profile';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function playerCount(Database $database): int
    {
        $row = $database->fetchOne('SELECT COUNT(*) AS total FROM players');
        return max(0, (int) ($row['total'] ?? 0));
    }
}

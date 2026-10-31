<?php

declare(strict_types=1);

namespace Zone\Modules\Search;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Player Search module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: search" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class SearchModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: search';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function unclaimedStreetFindCount(Database $database): int
    {
        $row = $database->fetchOne(
            'SELECT COUNT(*) AS total FROM world_finds WHERE claimed_by IS NULL AND expires_at > :now',
            ['now' => time()],
        );
        return max(0, (int) ($row['total'] ?? 0));
    }
}

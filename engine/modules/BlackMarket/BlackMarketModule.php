<?php

declare(strict_types=1);

namespace Zone\Modules\BlackMarket;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Black Market module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: blackmarket" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class BlackMarketModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: blackmarket';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function activeSupplyCount(Database $database): int
    {
        $row = $database->fetchOne('SELECT COUNT(*) AS total FROM world_shop_supply WHERE quantity > 0');
        return max(0, (int) ($row['total'] ?? 0));
    }
}

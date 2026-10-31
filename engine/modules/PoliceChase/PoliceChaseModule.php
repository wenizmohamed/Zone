<?php

declare(strict_types=1);

namespace Zone\Modules\PoliceChase;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Police Chase module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: policeChase" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class PoliceChaseModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: policeChase';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    /** @return list<string> */
    public static function evasionDifficultyTiers(): array
    {
        return ['street', 'cruiser', 'interceptor', 'roadblock', 'helicopter'];
    }
}

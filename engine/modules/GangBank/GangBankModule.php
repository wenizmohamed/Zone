<?php

declare(strict_types=1);

namespace Zone\Modules\GangBank;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Gang Bank module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: gangBank" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class GangBankModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: gangBank';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }
}

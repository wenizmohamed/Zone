<?php

declare(strict_types=1);

namespace Zone\Modules\Jail;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Jail & Busting module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: jail" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class JailModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: jail';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }
}

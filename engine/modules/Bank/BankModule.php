<?php

declare(strict_types=1);

namespace Zone\Modules\Bank;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Banking module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: bank" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class BankModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: bank';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function totalBankedCash(Database $database): int
    {
        return (int) (($database->fetchOne('SELECT COALESCE(SUM(bank_balance), 0) AS total_bank FROM players')['total_bank'] ?? 0));
    }
}

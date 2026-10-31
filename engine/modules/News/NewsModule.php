<?php

declare(strict_types=1);

namespace Zone\Modules\News;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Game News module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: news" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class NewsModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: news';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function activeWorldEventCount(Database $database): int
    {
        $row = $database->fetchOne(
            'SELECT COUNT(*) AS total FROM world_events WHERE expires_at > :now',
            ['now' => time()],
        );
        return max(0, (int) ($row['total'] ?? 0));
    }
}

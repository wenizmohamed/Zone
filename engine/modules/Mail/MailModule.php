<?php

declare(strict_types=1);

namespace Zone\Modules\Mail;

use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Mail module.
 * Ported from the Gangster Legends V2 / OpenPBBG "Gangster Legends V2 (openPBBG) module: mail" module.
 * Original source retained under ./source for progressive server-side porting.
 */
final class MailModule implements GameModule
{
    public const SOURCE = 'Gangster Legends V2 / OpenPBBG :: Gangster Legends V2 (openPBBG) module: mail';

    public function boot(EventBus $events, Database $database): void
    {
        // Registered and enabled via ModuleRegistry. Gameplay logic ports from the
        // embedded OpenPBBG source into server-authoritative handlers.
    }

    public static function unreadNotificationCount(Database $database, string $playerId): int
    {
        $row = $database->fetchOne(
            'SELECT COUNT(*) AS total FROM notifications WHERE player_id = :player AND read_at IS NULL',
            ['player' => $playerId],
        );
        return max(0, (int) ($row['total'] ?? 0));
    }
}

<?php
declare(strict_types=1);
namespace Zone\Modules\Gangs;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Server-owned recruitment. An empty family's first real member becomes its leader. */
final readonly class FactionService
{
    public function __construct(private Database $database, private EventBus $events) {}

    /** Caller holds the player's mutation lock; membership and its hook are atomic. */
    public function join(string $playerId, string $factionId): void
    {
        if (!preg_match('/^[a-z0-9-]{2,64}$/D', $factionId)) throw new InvalidArgumentException('Unknown faction.');
        $this->database->playerTransaction($playerId, function () use ($playerId, $factionId): void {
            // Serialize empty-family recruitment before counting members on PostgreSQL.
            // SQLite already owns its write lock through playerTransaction.
            $family = $this->database->fetchOne('SELECT id FROM factions WHERE id = :id AND enabled = 1' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''), ['id' => $factionId]);
            if ($family === null) throw new InvalidArgumentException('Unknown faction.');
            if ($this->database->fetchOne('SELECT player_id FROM faction_members WHERE player_id = :id', ['id' => $playerId]) !== null) throw new RuntimeException('You already belong to a family.');
            $members = (int) $this->database->fetchOne('SELECT COUNT(*) AS total FROM faction_members WHERE faction_id = :id', ['id' => $factionId])['total'];
            $role = $members === 0 ? 'leader' : 'member';
            $this->database->execute('INSERT INTO faction_members (player_id, faction_id, role, joined_at) VALUES (:player, :faction, :role, :joined)', ['player' => $playerId, 'faction' => $factionId, 'role' => $role, 'joined' => gmdate('c')]);
            $this->events->publish(new DomainEvent('FactionJoined', ['playerId' => $playerId, 'factionId' => $factionId, 'role' => $role, 'correlationId' => bin2hex(random_bytes(16))]));
        });
    }
}

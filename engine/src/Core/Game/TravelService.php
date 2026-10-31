<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class TravelService
{
    public function __construct(private readonly Database $database, private readonly EventBus $events, private readonly ?\Closure $clock = null) {}

    public function snapshot(string $playerId): ?array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId): ?array {
            $row = $this->database->fetchOne('SELECT * FROM player_travel WHERE player_id = :id', ['id' => $playerId]);
            if ($row === null) return null;
            $now = $this->now();
            $arrives = strtotime($row['arrives_at']);
            if ($row['status'] === 'traveling' && $arrives <= $now) {
                $this->database->execute('UPDATE players SET city = :city WHERE id = :id', ['city' => $row['destination'], 'id' => $playerId]);
                $this->database->execute("UPDATE player_travel SET status = 'arrived' WHERE player_id = :id", ['id' => $playerId]);
                $row['status'] = 'arrived';
                $this->events->publish(new DomainEvent('PlayerArrived', ['playerId' => $playerId, 'city' => $row['destination'], 'arrivedAt' => $row['arrives_at'], 'version' => (int) $row['version']]));
            }
            $departed = strtotime($row['departed_at']);
            $totalSeconds = max(1, $arrives - $departed);
            $remaining = $row['status'] === 'arrived' ? 0 : max(0, $arrives - $now);
            return ['origin' => $row['origin'], 'destination' => $row['destination'], 'departedAt' => $row['departed_at'], 'arrivesAt' => $row['arrives_at'], 'status' => $row['status'], 'remainingSeconds' => $remaining, 'totalSeconds' => $totalSeconds, 'progressPct' => $row['status'] === 'arrived' ? 100 : (int) min(100, max(0, round(($totalSeconds - $remaining) / $totalSeconds * 100))), 'version' => (int) $row['version']];
        });
    }

    public function assertAvailable(string $playerId): void
    {
        if (($this->snapshot($playerId)['status'] ?? null) === 'traveling') throw new RuntimeException('You are traveling. Wait for arrival before this action.');
    }

    public function isTraveling(string $playerId): bool
    {
        return ($this->snapshot($playerId)['status'] ?? null) === 'traveling';
    }

    /** Must share the player transaction that debits the fare. */
    public function depart(string $playerId, string $origin, string $destination, int $seconds): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $origin, $destination, $seconds): array {
            $this->assertAvailable($playerId);
            $now = $this->now();
            $this->database->execute(
                'INSERT INTO player_travel (player_id, origin, destination, departed_at, arrives_at, status, version) VALUES (:id, :origin, :destination, :departed, :arrives, :status, 1) '
                . 'ON CONFLICT (player_id) DO UPDATE SET origin = excluded.origin, destination = excluded.destination, departed_at = excluded.departed_at, arrives_at = excluded.arrives_at, status = excluded.status, version = player_travel.version + 1',
                ['id' => $playerId, 'origin' => $origin, 'destination' => $destination, 'departed' => gmdate('c', $now), 'arrives' => gmdate('c', $now + max(1, $seconds)), 'status' => 'traveling']);
            return $this->snapshot($playerId);
        });
    }
    private function now(): int { return $this->clock === null ? time() : ($this->clock)(); }
}

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Zone\Engine\Core\Persistence\Database;

/**
 * Server-clock cooldown store. Every cooldown decision is made against the
 * server's own clock (time()), never a client-supplied timestamp, so a client
 * cannot shorten or skip a cooldown. Backed by the portable action_cooldowns
 * table (SQLite + PostgreSQL).
 */
final readonly class CooldownService
{
    public function __construct(private Database $database)
    {
    }

    /**
     * Reject the action if its cooldown has not elapsed for this player.
     */
    public function assertReady(string $playerId, string $action): void
    {
        $row = $this->database->fetchOne(
            'SELECT available_at FROM action_cooldowns WHERE player_id = :player AND action = :action',
            ['player' => $playerId, 'action' => $action],
        );
        if ($row === null) {
            return;
        }
        $availableAt = strtotime((string) $row['available_at']) ?: 0;
        $now = time();
        if ($now < $availableAt) {
            throw new CooldownException($action, $availableAt - $now);
        }
    }

    /**
     * Arm the cooldown: the action becomes available again in $seconds.
     * A non-positive duration is a no-op (the action has no cooldown).
     */
    public function arm(string $playerId, string $action, int $seconds): void
    {
        if ($seconds <= 0) {
            return;
        }
        $availableAt = gmdate('c', time() + $seconds);
        $updated = $this->database->execute(
            'UPDATE action_cooldowns SET available_at = :ts WHERE player_id = :player AND action = :action',
            ['ts' => $availableAt, 'player' => $playerId, 'action' => $action],
        );
        if ($updated === 0) {
            $this->database->execute(
                'INSERT INTO action_cooldowns (player_id, action, available_at) VALUES (:player, :action, :ts)',
                ['player' => $playerId, 'action' => $action, 'ts' => $availableAt],
            );
        }
    }

    public function remainingSeconds(string $playerId, string $action): int
    {
        $row = $this->database->fetchOne(
            'SELECT available_at FROM action_cooldowns WHERE player_id = :player AND action = :action',
            ['player' => $playerId, 'action' => $action],
        );
        if ($row === null) {
            return 0;
        }
        $availableAt = strtotime((string) $row['available_at']) ?: 0;
        return max(0, $availableAt - time());
    }

    /** @return array<string, int> */
    public function activeCooldowns(string $playerId): array
    {
        $now = time();
        $active = [];
        foreach ($this->database->fetchAll('SELECT action, available_at FROM action_cooldowns WHERE player_id = :player', ['player' => $playerId]) as $row) {
            $rem = max(0, (strtotime((string) $row['available_at']) ?: 0) - $now);
            if ($rem > 0) {
                $active[(string) $row['action']] = $rem;
            }
        }
        return $active;
    }
}

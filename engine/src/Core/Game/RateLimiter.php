<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Zone\Engine\Core\Persistence\Database;

/**
 * Per-player fixed-window action rate limiter. This is the cross-action
 * anti-bot / anti-hammer control: even if an attacker rotates across many
 * different endpoints to dodge per-action cooldowns, they cannot exceed $max
 * state-changing actions inside a $windowSeconds window. Uses the server clock
 * only and stores one bounded row per player (action_rate_limits table).
 *
 * $max <= 0 disables the limiter entirely (explicit opt-out).
 */
final readonly class RateLimiter
{
    public function __construct(
        private Database $database,
        private int $max = 120,
        private int $windowSeconds = 10,
    ) {
    }

    public function hit(string $playerId): void
    {
        if ($this->max <= 0) {
            return;
        }
        $now = time();
        $row = $this->database->fetchOne(
            'SELECT window_started_at, count FROM action_rate_limits WHERE player_id = :player',
            ['player' => $playerId],
        );
        if ($row === null) {
            $this->database->execute(
                'INSERT INTO action_rate_limits (player_id, window_started_at, count) VALUES (:player, :ts, 1)',
                ['player' => $playerId, 'ts' => gmdate('c', $now)],
            );
            return;
        }
        $windowStart = strtotime((string) $row['window_started_at']) ?: 0;
        $elapsed = $now - $windowStart;
        if ($elapsed >= $this->windowSeconds) {
            $this->database->execute(
                'UPDATE action_rate_limits SET window_started_at = :ts, count = 1 WHERE player_id = :player',
                ['ts' => gmdate('c', $now), 'player' => $playerId],
            );
            return;
        }
        if ((int) $row['count'] >= $this->max) {
            throw new RateLimitException(max(1, $this->windowSeconds - $elapsed));
        }
        $this->database->execute(
            'UPDATE action_rate_limits SET count = count + 1 WHERE player_id = :player',
            ['player' => $playerId],
        );
    }
}

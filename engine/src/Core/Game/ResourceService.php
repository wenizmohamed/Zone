<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use RuntimeException;
use Zone\Engine\Core\Persistence\Database;

final readonly class ResourceService
{
    public function __construct(
        private Database $database,
        private ?NotificationService $notifications = null,
        private ?\Closure $clock = null,
    ) {
    }

    public function regenerate(string $playerId): array
    {
        return $this->database->playerTransaction($playerId, fn (): array => $this->regenerateLocked($playerId));
    }

    private function regenerateLocked(string $playerId): array
    {
        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }

        $now = $this->clock === null ? time() : ($this->clock)();
        $then = strtotime($player['resources_updated_at']) ?: $now;
        // Count server-clock boundaries, not whole intervals since the last
        // request. Polling every minute must not discard slower bars' progress.
        $elapsedMinutes = max(0, intdiv($now, 60) - intdiv($then, 60));
        if ($elapsedMinutes > 0) {
            // Torn-faithful regen cadence (from real getBars): energy +1/3min, nerve +1/5min,
            // life +1/min, happy +1/3min. Mirrors Torn's 5-per-900s / 1-per-300s / 5-per-300s ticks.
            $maxEnergy = (int) $player['max_energy'];
            $maxNerve = (int) $player['max_nerve'];
            $oldEnergy = (int) $player['energy'];
            $oldNerve = (int) $player['nerve'];
            $energyTicks = max(0, intdiv($now, 180) - intdiv($then, 180));
            $nerveTicks = max(0, intdiv($now, 300) - intdiv($then, 300));
            $energy = min($maxEnergy, $oldEnergy + $energyTicks);
            $nerve = min($maxNerve, $oldNerve + $nerveTicks);
            $life = min((int) $player['max_life'], (int) $player['life'] + $elapsedMinutes);
            $happy = min((int) $player['max_happy'], (int) $player['happy'] + $energyTicks);
            $this->database->execute(
                'UPDATE players SET energy = :energy, nerve = :nerve, life = :life, happy = :happy, resources_updated_at = :updated WHERE id = :id',
                ['id' => $playerId, 'energy' => $energy, 'nerve' => $nerve, 'life' => $life, 'happy' => $happy, 'updated' => gmdate('c', intdiv($now, 60) * 60)],
            );

            // Cap-waste nudge: a bar that just topped out is regen the player is
            // now wasting. Manufactures the Torn FOMO pull (Retention Spec 3.3).
            if ($this->notifications !== null) {
                if ($nerve === $maxNerve && $oldNerve < $maxNerve) {
                    $this->notifications->capWasteNudge($playerId, 'nerve');
                }
                if ($energy === $maxEnergy && $oldEnergy < $maxEnergy) {
                    $this->notifications->capWasteNudge($playerId, 'energy');
                }
            }

            $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        }

        return $this->normalize($player);
    }

    public function normalize(array $player): array
    {
        foreach (['level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance'] as $field) {
            $player[$field] = (int) $player[$field];
        }
        return $player;
    }
}

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use RuntimeException;
use Zone\Engine\Core\Persistence\Database;

final readonly class ResourceService
{
    public function __construct(private Database $database)
    {
    }

    public function regenerate(string $playerId): array
    {
        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }

        $then = strtotime($player['resources_updated_at']) ?: time();
        $elapsedMinutes = max(0, intdiv(time() - $then, 60));
        if ($elapsedMinutes > 0) {
            // Torn-faithful regen cadence (from real getBars): energy +1/3min, nerve +1/5min,
            // life +1/min, happy +1/3min. Mirrors Torn's 5-per-900s / 1-per-300s / 5-per-300s ticks.
            $energy = min((int) $player['max_energy'], (int) $player['energy'] + intdiv($elapsedMinutes, 3));
            $nerve = min((int) $player['max_nerve'], (int) $player['nerve'] + intdiv($elapsedMinutes, 5));
            $life = min((int) $player['max_life'], (int) $player['life'] + $elapsedMinutes);
            $happy = min((int) $player['max_happy'], (int) $player['happy'] + intdiv($elapsedMinutes, 3));
            $this->database->execute(
                'UPDATE players SET energy = :energy, nerve = :nerve, life = :life, happy = :happy, resources_updated_at = :updated WHERE id = :id',
                ['id' => $playerId, 'energy' => $energy, 'nerve' => $nerve, 'life' => $life, 'happy' => $happy, 'updated' => gmdate('c')],
            );
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

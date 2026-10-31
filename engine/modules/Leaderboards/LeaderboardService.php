<?php
declare(strict_types=1);
namespace Zone\Modules\Leaderboards;

use Zone\Engine\Core\Persistence\Database;

/** Bounded public standings. Never exposes account/session or progression blobs. */
final readonly class LeaderboardService
{
    public function __construct(private Database $database) {}

    public function snapshot(string $playerId): array
    {
        $rows = $this->database->fetchAll(
            'SELECT p.id, p.username, p.level, (p.strength + p.defense + p.speed + p.dexterity) AS total_stats,
                    (p.cash + p.bank_balance) AS liquid_funds, f.id AS faction_id, f.name_en, f.name_ar
             FROM players p LEFT JOIN faction_members m ON m.player_id = p.id
             LEFT JOIN factions f ON f.id = m.faction_id
             WHERE p.id <> :fixture
             ORDER BY total_stats DESC, p.level DESC, p.id ASC LIMIT 50', ['fixture' => 'founder-player'],
        );
        $topStats = empty($rows) ? 1 : max(1, (int) $rows[0]['total_stats']);
        return ['generatedAt' => gmdate('c'), 'limit' => 50, 'metric' => 'battle-stats', 'rows' => array_map(
            static fn (array $row, int $index): array => [
                'rank' => $index + 1, 'username' => (string) $row['username'], 'level' => (int) $row['level'],
                'totalStats' => (int) $row['total_stats'], 'liquidFunds' => (int) $row['liquid_funds'],
                'powerTier' => (int) $row['total_stats'] >= 4000 ? 'Apex' : ((int) $row['total_stats'] >= 2000 ? 'Elite' : ((int) $row['total_stats'] >= 800 ? 'Veteran' : 'Rising')),
                'vsLeaderPct' => (int) round((int) $row['total_stats'] / $topStats * 100),
                'family' => $row['faction_id'] === null ? null : ['id' => (string) $row['faction_id'], 'name' => ['en' => (string) $row['name_en'], 'ar' => (string) $row['name_ar']]],
                'isCurrentPlayer' => (string) $row['id'] === $playerId,
            ], $rows, array_keys($rows)),
        ];
    }
}

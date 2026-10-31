<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Economy;

use Zone\Engine\Core\Persistence\Database;

final readonly class Ledger
{
    public function __construct(private Database $database)
    {
    }

    public function record(string $playerId, string $asset, int $amount, int $balanceAfter, string $reason, string $correlationId): void
    {
        $this->database->execute(
            'INSERT INTO economy_ledger (id, player_id, asset, amount, balance_after, reason, correlation_id, created_at) VALUES (:id, :player, :asset, :amount, :balance, :reason, :correlation, :created_at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'player' => $playerId,
                'asset' => $asset,
                'amount' => $amount,
                'balance' => $balanceAfter,
                'reason' => $reason,
                'correlation' => $correlationId,
                'created_at' => gmdate('c'),
            ],
        );
    }

    public function summary(string $playerId): array
    {
        $row = $this->database->fetchOne(
            "SELECT COUNT(*) AS total_entries, COALESCE(SUM(CASE WHEN asset = 'cash' THEN amount ELSE 0 END), 0) AS net_cash_flow FROM economy_ledger WHERE player_id = :player",
            ['player' => $playerId],
        );
        return [
            'totalEntries' => (int) ($row['total_entries'] ?? 0),
            'netCashFlow' => (int) ($row['net_cash_flow'] ?? 0),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function recentEntries(string $playerId, int $limit = 10): array
    {
        $safeLimit = max(1, min(50, $limit));
        return $this->database->fetchAll(
            "SELECT id, asset, amount, balance_after, reason, correlation_id, created_at FROM economy_ledger WHERE player_id = :player ORDER BY created_at DESC LIMIT {$safeLimit}",
            ['player' => $playerId],
        );
    }
}

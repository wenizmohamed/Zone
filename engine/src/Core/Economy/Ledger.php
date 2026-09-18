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
}

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Content;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class ContentManager
{
    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
    }

    public function crimes(bool $includeDisabled = false): array
    {
        $where = $includeDisabled ? '' : ' WHERE enabled = 1';
        return array_map(
            fn (array $crime): array => $this->normalizeCrime($crime),
            $this->database->fetchAll("SELECT * FROM crimes{$where} ORDER BY nerve_cost, id"),
        );
    }

    public function saveCrime(string $id, array $payload, string $actor): array
    {
        $definition = $this->validateCrime($id, $payload);
        $actor = $this->validateActor($actor);
        $previous = $this->database->fetchOne('SELECT * FROM crimes WHERE id = :id', ['id' => $id]);
        $correlationId = bin2hex(random_bytes(16));
        $now = gmdate('c');

        $this->database->transaction(function () use ($definition, $previous, $actor, $correlationId, $now): void {
            $this->database->execute(
                'INSERT INTO crimes (id, name_en, name_ar, nerve_cost, success_basis_points, cash_min, cash_max, xp_reward, enabled) '
                . 'VALUES (:id, :name_en, :name_ar, :nerve_cost, :success_basis_points, :cash_min, :cash_max, :xp_reward, :enabled) '
                . 'ON CONFLICT (id) DO UPDATE SET name_en = excluded.name_en, name_ar = excluded.name_ar, nerve_cost = excluded.nerve_cost, '
                . 'success_basis_points = excluded.success_basis_points, cash_min = excluded.cash_min, cash_max = excluded.cash_max, '
                . 'xp_reward = excluded.xp_reward, enabled = excluded.enabled',
                $definition,
            );
            $this->recordAudit(
                $previous === null ? 'CrimeCreated' : 'CrimeUpdated',
                'crime',
                $definition['id'],
                $previous === null ? null : $this->normalizeCrime($previous),
                $this->normalizeCrime($definition),
                $actor,
                $correlationId,
                $now,
            );
            $this->events->publish(new DomainEvent('CrimeDefinitionSaved', [
                'crimeId' => $definition['id'],
                'actor' => $actor,
                'created' => $previous === null,
                'enabled' => (bool) $definition['enabled'],
                'correlationId' => $correlationId,
            ]));
        });

        $saved = $this->database->fetchOne('SELECT * FROM crimes WHERE id = :id', ['id' => $id]);
        if ($saved === null) {
            throw new RuntimeException('Saved crime definition could not be loaded.');
        }

        return [...$this->normalizeCrime($saved), 'correlationId' => $correlationId];
    }

    public function auditLog(int $limit = 100): array
    {
        $limit = max(1, min(250, $limit));
        $rows = $this->database->fetchAll("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT {$limit}");
        return array_map(static function (array $row): array {
            foreach (['previous_json' => 'previous', 'next_json' => 'next'] as $source => $target) {
                $row[$target] = $row[$source] === null ? null : json_decode((string) $row[$source], true, 64, JSON_THROW_ON_ERROR);
                unset($row[$source]);
            }
            return $row;
        }, $rows);
    }

    private function validateCrime(string $id, array $payload): array
    {
        if (!preg_match('/^[a-z][a-z0-9-]{1,79}$/', $id)) {
            throw new InvalidArgumentException('Crime id must contain 2 to 80 lowercase letters, numbers, or hyphens.');
        }

        $nameEn = $this->text($payload['name_en'] ?? null, 'English name', 160);
        $nameAr = $this->text($payload['name_ar'] ?? null, 'Arabic name', 160);
        $nerveCost = $this->integer($payload['nerve_cost'] ?? null, 'Nerve cost', 1, 1000);
        $successBasisPoints = $this->integer($payload['success_basis_points'] ?? null, 'Success basis points', 0, 10000);
        $cashMin = $this->integer($payload['cash_min'] ?? null, 'Minimum cash reward', 0, 2_000_000_000);
        $cashMax = $this->integer($payload['cash_max'] ?? null, 'Maximum cash reward', $cashMin, 2_000_000_000);
        $xpReward = $this->integer($payload['xp_reward'] ?? null, 'XP reward', 0, 1_000_000_000);
        $enabled = $payload['enabled'] ?? true;
        if (!is_bool($enabled)) {
            throw new InvalidArgumentException('Crime enabled must be a boolean.');
        }

        return [
            'id' => $id,
            'name_en' => $nameEn,
            'name_ar' => $nameAr,
            'nerve_cost' => $nerveCost,
            'success_basis_points' => $successBasisPoints,
            'cash_min' => $cashMin,
            'cash_max' => $cashMax,
            'xp_reward' => $xpReward,
            'enabled' => $enabled ? 1 : 0,
        ];
    }

    private function normalizeCrime(array $crime): array
    {
        foreach (['nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward'] as $field) {
            $crime[$field] = (int) $crime[$field];
        }
        $crime['enabled'] = (bool) $crime['enabled'];
        $crime['successRate'] = $crime['success_basis_points'] / 100;
        return $crime;
    }

    private function text(mixed $value, string $label, int $maximum): string
    {
        if (!is_string($value)) {
            throw new InvalidArgumentException("{$label} must be text.");
        }
        $value = trim($value);
        if ($value === '' || strlen($value) > $maximum) {
            throw new InvalidArgumentException("{$label} must contain 1 to {$maximum} characters.");
        }
        return $value;
    }

    private function integer(mixed $value, string $label, int $minimum, int $maximum): int
    {
        $validated = filter_var($value, FILTER_VALIDATE_INT);
        if ($validated === false || $validated < $minimum || $validated > $maximum) {
            throw new InvalidArgumentException("{$label} must be an integer between {$minimum} and {$maximum}.");
        }
        return $validated;
    }

    private function validateActor(string $actor): string
    {
        $actor = trim($actor);
        if ($actor === '' || strlen($actor) > 160) {
            throw new InvalidArgumentException('Admin actor must contain 1 to 160 characters.');
        }
        return $actor;
    }

    private function recordAudit(
        string $action,
        string $targetType,
        string $targetId,
        mixed $previous,
        mixed $next,
        string $actor,
        string $correlationId,
        string $createdAt,
    ): void {
        $this->database->execute(
            'INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, previous_json, next_json, correlation_id, created_at) '
            . 'VALUES (:id, :actor, :action, :target_type, :target_id, :previous_json, :next_json, :correlation_id, :created_at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'actor' => $actor,
                'action' => $action,
                'target_type' => $targetType,
                'target_id' => $targetId,
                'previous_json' => $previous === null ? null : json_encode($previous, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'next_json' => $next === null ? null : json_encode($next, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'correlation_id' => $correlationId,
                'created_at' => $createdAt,
            ],
        );
    }
}

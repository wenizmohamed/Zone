<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Content;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Game\WorldDirector;

final class ContentManager
{
    private const RULE_DEFAULTS = [
        'required_item' => null, 'required_quantity' => 1, 'consume_tool' => false,
        'mastery_per_success' => 1, 'chain_window_seconds' => 300,
        'chain_bonus_basis_points' => 0, 'critical_failure_basis_points' => 0,
        'jail_seconds' => 0, 'hospital_seconds' => 0,
    ];

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
    }

    public function crimes(bool $includeDisabled = false): array
    {
        $where = $includeDisabled ? '' : ' WHERE c.enabled = 1';
        return array_map(
            fn (array $crime): array => $this->normalizeCrime($crime),
            $this->database->fetchAll("SELECT c.*, r.rules_json FROM crimes c LEFT JOIN crime_rules r ON r.crime_id = c.id{$where} ORDER BY c.nerve_cost, c.id"),
        );
    }

    /** Validate authoring against its complete prospective published catalog. */
    public static function validateWorldPolicy(mixed $policy, array $catalog): void
    {
        $bounds = ['tickSeconds' => [30,3600], 'findsPerTick' => [0,3], 'findQuantity' => [1,3], 'findLifetimeSeconds' => [60,86400], 'maxActiveFinds' => [1,64], 'supplyShift' => [0,20], 'supplyCap' => [1,1000], 'eventEveryTicks' => [1,100]];
        if (!is_array($policy) || array_diff(array_keys($policy), ['enabled', ...array_keys($bounds), 'findValueBudgetPerHour','searchValueBudgetPerHour','materialItemIds']) || (array_key_exists('enabled', $policy) && !is_bool($policy['enabled']))) throw new InvalidArgumentException('Invalid world director policy.');
        foreach ($bounds as $field => [$min,$max]) if (array_key_exists($field, $policy) && (!is_int($policy[$field]) || $policy[$field] < $min || $policy[$field] > $max)) throw new InvalidArgumentException('Invalid world director setting: ' . $field);
        $normalized = WorldDirector::normalizePolicy($policy);
        foreach ($normalized['materialItemIds'] ?? [] as $id) if (($catalog['items'][$id]['type'] ?? '') !== 'material') throw new InvalidArgumentException('World material item must exist as a material in the release catalog: ' . $id);
    }

    /** Omitted supported policy fields are retained; explicit null is an opt-out. */
    public static function preserveWorldPolicy(array $manifest, array $previous): array
    {
        if (!array_key_exists('worldPolicy', $manifest)) {
            if (array_key_exists('worldPolicy', $previous)) $manifest['worldPolicy'] = $previous['worldPolicy'];
        } elseif (is_array($manifest['worldPolicy']) && is_array($previous['worldPolicy'] ?? null)) {
            $manifest['worldPolicy'] = [...$previous['worldPolicy'], ...$manifest['worldPolicy']];
        }
        return $manifest;
    }

    public function saveCrime(string $id, array $payload, string $actor): array
    {
        $actor = $this->validateActor($actor);
        $previous = $this->database->fetchOne('SELECT c.*, r.rules_json FROM crimes c LEFT JOIN crime_rules r ON r.crime_id = c.id WHERE c.id = :id', ['id' => $id]);
        // Authoring a single field must not reset an untouched tool, level,
        // consequence or reward. New definitions still require the base fields.
        $definition = $this->validateCrime($id, [...($previous === null ? [] : $this->normalizeCrime($previous)), ...$payload]);
        $correlationId = bin2hex(random_bytes(16));
        $now = gmdate('c');

        $this->database->transaction(function () use ($definition, $previous, $actor, $correlationId, $now): void {
            $this->database->execute(
                'INSERT INTO crimes (id, name_en, name_ar, nerve_cost, success_basis_points, cash_min, cash_max, xp_reward, level_required, enabled) '
                . 'VALUES (:id, :name_en, :name_ar, :nerve_cost, :success_basis_points, :cash_min, :cash_max, :xp_reward, :level_required, :enabled) '
                . 'ON CONFLICT (id) DO UPDATE SET name_en = excluded.name_en, name_ar = excluded.name_ar, nerve_cost = excluded.nerve_cost, '
                . 'success_basis_points = excluded.success_basis_points, cash_min = excluded.cash_min, cash_max = excluded.cash_max, '
                . 'xp_reward = excluded.xp_reward, level_required = excluded.level_required, enabled = excluded.enabled',
                array_diff_key($definition, self::RULE_DEFAULTS),
            );
            $this->database->execute('INSERT INTO crime_rules (crime_id, rules_json) VALUES (:id, :rules) ON CONFLICT (crime_id) DO UPDATE SET rules_json = excluded.rules_json', [
                'id' => $definition['id'], 'rules' => json_encode(array_intersect_key($definition, self::RULE_DEFAULTS), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            ]);
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

        $saved = $this->database->fetchOne('SELECT c.*, r.rules_json FROM crimes c LEFT JOIN crime_rules r ON r.crime_id = c.id WHERE c.id = :id', ['id' => $id]);
        if ($saved === null) {
            throw new RuntimeException('Saved crime definition could not be loaded.');
        }

        return [...$this->normalizeCrime($saved), 'correlationId' => $correlationId];
    }

    public function auditLog(int $limit = 100, bool $includeSnapshots = true): array
    {
        $limit = max(1, min(250, $limit));
        $columns = $includeSnapshots ? '*' : 'id, actor, action, target_type, target_id, correlation_id, created_at';
        $rows = $this->database->fetchAll("SELECT {$columns} FROM admin_audit_log ORDER BY created_at DESC LIMIT {$limit}");
        if (!$includeSnapshots) return $rows;
        return array_map(static function (array $row): array {
            foreach (['previous_json' => 'previous', 'next_json' => 'next'] as $source => $target) {
                $row[$target] = $row[$source] === null ? null : json_decode((string) $row[$source], true, 64, JSON_THROW_ON_ERROR);
                unset($row[$source]);
            }
            return $row;
        }, $rows);
    }

    public function crimeSummary(): array
    {
        $all = $this->crimes(true);
        $enabled = array_filter($all, static fn (array $c): bool => (bool) ($c['enabled'] ?? false));
        $evValues = array_map(static fn (array $c): float => (float) ($c['expectedCashPerNerve'] ?? 0.0), $enabled);
        return [
            'totalCount' => count($all),
            'enabledCount' => count($enabled),
            'maxExpectedCashPerNerve' => $evValues === [] ? 0.0 : max($evValues),
        ];
    }

    public function auditEntryCount(): int
    {
        $row = $this->database->fetchOne('SELECT COUNT(*) AS total FROM admin_audit_log');
        return max(0, (int) ($row['total'] ?? 0));
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
        $levelRequired = array_key_exists('level_required', $payload) && $payload['level_required'] !== null
            ? $this->integer($payload['level_required'], 'Level required', 1, 100)
            : 1;
        $enabled = $payload['enabled'] ?? true;
        if (!is_bool($enabled)) {
            throw new InvalidArgumentException('Crime enabled must be a boolean.');
        }

        $rules = [...self::RULE_DEFAULTS, ...array_intersect_key($payload, self::RULE_DEFAULTS)];
        if ($rules['required_item'] !== null && (!is_string($rules['required_item']) || !preg_match('/^[A-Za-z0-9_-]{1,80}$/D', $rules['required_item']))) {
            throw new InvalidArgumentException('Required item must be an item ID or null.');
        }
        if ($rules['required_item'] !== null) {
            $catalog = (new GameplayCatalog($this->database, $this->events))->draft()['catalogs'];
            if (!isset($catalog['items'][$rules['required_item']])) throw new InvalidArgumentException('Required item must exist in the gameplay catalog.');
        }
        if (!is_bool($rules['consume_tool'])) throw new InvalidArgumentException('Consume tool must be a boolean.');
        foreach (['required_quantity' => [1, 1000], 'mastery_per_success' => [0, 100], 'chain_window_seconds' => [0, 86400], 'chain_bonus_basis_points' => [0, 2000], 'critical_failure_basis_points' => [0, 10000], 'jail_seconds' => [0, 86400], 'hospital_seconds' => [0, 86400]] as $field => [$minimum, $maximum]) {
            $rules[$field] = $this->integer($rules[$field], $field, $minimum, $maximum);
        }
        if ($rules['consume_tool'] && $rules['required_item'] === null) throw new InvalidArgumentException('A consumed tool requires an item ID.');
        if ($rules['critical_failure_basis_points'] > 0 && $rules['jail_seconds'] + $rules['hospital_seconds'] === 0) throw new InvalidArgumentException('Critical failures require a jail or hospital consequence.');

        return [
            'id' => $id,
            'name_en' => $nameEn,
            'name_ar' => $nameAr,
            'nerve_cost' => $nerveCost,
            'success_basis_points' => $successBasisPoints,
            'cash_min' => $cashMin,
            'cash_max' => $cashMax,
            'xp_reward' => $xpReward,
            'level_required' => $levelRequired,
            'enabled' => $enabled ? 1 : 0,
            ...$rules,
        ];
    }

    private function normalizeCrime(array $crime): array
    {
        $rules = isset($crime['rules_json']) ? json_decode((string) $crime['rules_json'], true, 64, JSON_THROW_ON_ERROR) : [];
        unset($crime['rules_json']);
        $crime = [...self::RULE_DEFAULTS, ...$crime, ...$rules];
        foreach (['nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward'] as $field) {
            $crime[$field] = (int) $crime[$field];
        }
        $crime['level_required'] = (int) ($crime['level_required'] ?? 1);
        $crime['enabled'] = (bool) $crime['enabled'];
        $crime['successRate'] = $crime['success_basis_points'] / 100;
        $crime['expectedCashPerNerve'] = round(((($crime['cash_min'] + $crime['cash_max']) / 2) * ($crime['success_basis_points'] / 10000)) / max(1, $crime['nerve_cost']), 2);
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

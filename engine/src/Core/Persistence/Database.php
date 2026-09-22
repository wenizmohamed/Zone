<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Persistence;

use PDO;
use RuntimeException;
use Throwable;

final class Database
{
    private function __construct(private readonly PDO $pdo, private readonly string $driver)
    {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    }

    public static function connect(?string $databaseUrl = null): self
    {
        if ($databaseUrl === null || $databaseUrl === '' || str_starts_with($databaseUrl, 'sqlite:')) {
            $path = $databaseUrl !== null && str_starts_with($databaseUrl, 'sqlite:')
                ? substr($databaseUrl, 7)
                : ZONE_ENGINE_ROOT . '/var/zone-engine.sqlite';
            if ($path !== ':memory:') {
                $directory = dirname($path);
                if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                    throw new RuntimeException("Unable to create database directory: {$directory}");
                }
            }
            $pdo = new PDO('sqlite:' . $path);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
            return new self($pdo, 'sqlite');
        }

        if (!str_starts_with($databaseUrl, 'postgresql://') && !str_starts_with($databaseUrl, 'postgres://')) {
            throw new RuntimeException('ZONE_DATABASE_URL must use sqlite:, postgres://, or postgresql://.');
        }

        $parts = parse_url($databaseUrl);
        if ($parts === false || !isset($parts['host'], $parts['path'])) {
            throw new RuntimeException('Invalid PostgreSQL database URL.');
        }
        $database = ltrim($parts['path'], '/');
        $query = [];
        parse_str($parts['query'] ?? '', $query);
        $sslMode = preg_match('/^[a-z-]+$/', (string) ($query['sslmode'] ?? 'require'))
            ? (string) ($query['sslmode'] ?? 'require')
            : 'require';
        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
            $parts['host'],
            $parts['port'] ?? 5432,
            $database,
            $sslMode,
        );
        if (str_ends_with(strtolower($parts['host']), '.neon.tech')) {
            $endpointId = preg_replace('/-pooler$/', '', explode('.', $parts['host'])[0]);
            if (is_string($endpointId) && preg_match('/^ep-[a-z0-9-]+$/', $endpointId)) {
                $dsn .= ";options='endpoint={$endpointId}'";
            }
        }
        $pdo = new PDO($dsn, urldecode($parts['user'] ?? ''), urldecode($parts['pass'] ?? ''));
        return new self($pdo, 'pgsql');
    }

    public function driver(): string
    {
        return $this->driver;
    }

    public function migrateAndSeed(): void
    {
        $schema = ZONE_ENGINE_ROOT . '/database/schema.' . ($this->driver === 'pgsql' ? 'postgresql' : 'sqlite') . '.sql';
        $sql = file_get_contents($schema);
        if ($sql === false) {
            throw new RuntimeException("Unable to read schema: {$schema}");
        }
        $this->pdo->exec($sql);
        $this->seedFoundationContent();
    }

    private function seedFoundationContent(): void
    {
        $now = gmdate('c');
        // Founder is an inflated demo seed (level 12, oversized bars). last_login_day
        // is pinned to today so the login-streak hook treats the demo account as
        // already claimed for the current UTC day.
        $this->insertIgnore(
            'players',
            ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
            ['founder-player', 'Vincenzo', 12, 4982, 48500, 150, 50, 3000, 500, 150, 50, 3000, 500, $now, 240, 180, 210, 165, 120000, 'Zone City', 1, gmdate('Y-m-d')],
        );

        // Real Torn Crimes 2.0 roster (from HAR: crimesData step=hub). Nerve cost
        // rises with tier; cash is rebalanced so cash-per-nerve is monotonic across
        // tiers (Retention Spec 3.2) and level_required staggers the roster.
        // [id, name_en, name_ar, nerve_cost, success_bp, cash_min, cash_max, xp, level_required]
        $crimes = [
            ['searchforcash', 'Search for Cash', 'البحث عن نقود', 2, 9000, 80, 240, 6, 1],
            ['bootlegging', 'Bootlegging', 'تهريب الكحول', 3, 8500, 200, 520, 10, 1],
            ['graffiti', 'Graffiti', 'الكتابة على الجدران', 4, 8000, 300, 800, 12, 3],
            ['shoplifting', 'Shoplifting', 'السرقة من المتاجر', 5, 7500, 450, 1150, 16, 5],
            ['pickpocketing', 'Pickpocketing', 'النشل', 6, 7000, 650, 1600, 20, 8],
            ['cardskimming', 'Card Skimming', 'نسخ البطاقات', 8, 6200, 1100, 2800, 30, 12],
            ['burglary', 'Burglary', 'السطو على المنازل', 10, 5400, 1900, 4600, 44, 16],
        ];
        foreach ($crimes as $crime) {
            $this->insertIgnore(
                'crimes',
                ['id', 'name_en', 'name_ar', 'nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward', 'level_required', 'enabled'],
                [...$crime, 1],
            );
        }

        // Server-clock cooldown floors (seconds), owned as config not code.
        // Bank stays at 0 (balance-gated); the rate limiter still covers it.
        $cooldowns = [
            'crime' => 5, 'attack' => 8, 'gym' => 3, 'job' => 10,
            'blackjack' => 3, 'travel' => 15, 'hospital' => 5, 'bank' => 0,
        ];
        foreach ($cooldowns as $action => $seconds) {
            $this->insertIgnore('cooldown_config', ['action', 'seconds'], [$action, $seconds]);
        }
    }

    public function insertIgnore(string $table, array $columns, array $values): void
    {
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $columnSql = implode(', ', $columns);
        $verb = $this->driver === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT';
        $suffix = $this->driver === 'pgsql' ? ' ON CONFLICT DO NOTHING' : '';
        $statement = $this->pdo->prepare("{$verb} INTO {$table} ({$columnSql}) VALUES ({$placeholders}){$suffix}");
        $statement->execute($values);
    }

    public function fetchOne(string $sql, array $parameters = []): ?array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    public function fetchAll(string $sql, array $parameters = []): array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        return $statement->fetchAll();
    }

    public function execute(string $sql, array $parameters = []): int
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        return $statement->rowCount();
    }

    public function transaction(callable $callback): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $callback($this);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $exception;
        }
    }
}

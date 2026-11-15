<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Persistence;

use PDO;
use RuntimeException;
use Throwable;

final class Database
{
    private int $savepointSequence = 0;

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
            $pdo->exec('PRAGMA busy_timeout = 5000');
            try {
                $pdo->exec('PRAGMA journal_mode = WAL');
            } catch (Throwable) {
                $pdo->exec('PRAGMA journal_mode = DELETE');
            }
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
        // Modern libpq sends the endpoint hostname through TLS SNI. Supplying
        // a second, quoted endpoint option conflicts with Neon routing.
        $dsn .= ';connect_timeout=10';
        $pdo = new PDO($dsn, urldecode($parts['user'] ?? ''), urldecode($parts['pass'] ?? ''));
        return new self($pdo, 'pgsql');
    }

    public function driver(): string
    {
        return $this->driver;
    }

    public function health(): array
    {
        $row = $this->fetchOne("SELECT value FROM engine_metadata WHERE name = 'schema-fingerprint'");
        return [
            'driver' => $this->driver,
            'inTransaction' => $this->pdo->inTransaction(),
            'schemaFingerprint' => $row['value'] ?? null,
        ];
    }

    public function tableCount(): int
    {
        $sql = $this->driver === 'sqlite'
            ? "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            : "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = 'public'";
        $row = $this->fetchOne($sql);
        return (int) ($row['total'] ?? 0);
    }

    public function migrateAndSeed(): void
    {
        $schema = ZONE_ENGINE_ROOT . '/database/schema.' . ($this->driver === 'pgsql' ? 'postgresql' : 'sqlite') . '.sql';
        $sql = file_get_contents($schema);
        if ($sql === false) {
            throw new RuntimeException("Unable to read schema: {$schema}");
        }
        $fingerprint = hash('sha256', $sql . (string) file_get_contents(ZONE_ENGINE_ROOT . '/data/crimes.json'));
        try {
            $applied = $this->fetchOne("SELECT value FROM engine_metadata WHERE name = 'schema-fingerprint'");
            if (($applied['value'] ?? null) === $fingerprint) return;
        } catch (\PDOException) {
            // First boot or an older engine database. Never replace its data.
        }
        $this->transaction(function () use ($schema): void {
            if ($this->driver === 'pgsql') $this->pdo->exec('SELECT pg_advisory_xact_lock(90120261005)');
            $this->pdo->exec('CREATE TABLE IF NOT EXISTS engine_metadata (name VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL)');
            $this->execute("INSERT INTO engine_metadata (name, value) VALUES ('schema-fingerprint', '') ON CONFLICT (name) DO NOTHING");
            // Serializes SQLite migration callers too, before the recheck.
            $this->execute("UPDATE engine_metadata SET value = value WHERE name = 'schema-fingerprint'");
            // An installer may have committed after this request captured its
            // fast-path bytes. Re-read both sources under the migration lock;
            // never seed or downgrade bookkeeping from that stale snapshot.
            $sql = file_get_contents($schema);
            $crimes = file_get_contents(ZONE_ENGINE_ROOT . '/data/crimes.json');
            if ($sql === false || $crimes === false) {
                throw new RuntimeException('Unable to read current migration sources.');
            }
            $fingerprint = hash('sha256', $sql . $crimes);
            $applied = $this->fetchOne("SELECT value FROM engine_metadata WHERE name = 'schema-fingerprint'");
            if (($applied['value'] ?? null) === $fingerprint) return;
            $this->pdo->exec($sql);
            $this->seedFoundationContent();
            $this->execute("UPDATE engine_metadata SET value = :value WHERE name = 'schema-fingerprint'", ['value' => $fingerprint]);
        });
    }

    public function seedEphemeralVercelWorld(): void
    {
        try {
            $seeded = $this->fetchOne("SELECT value FROM engine_metadata WHERE name = 'vercel-ephemeral-seed-v1'");
            if (($seeded['value'] ?? null) === '1') {
                return;
            }
        } catch (\PDOException) {
            return;
        }
        $this->transaction(function (): void {
            $now = gmdate('c');
            $today = gmdate('Y-m-d');
            $rivals = [
                ['npc-syndicate-apex', 'Duke_X', 34, 28400, 420000, 150, 55, 3600, 2500, 150, 55, 3600, 2500, $now, 6400, 5800, 6100, 5500, 2850000, 'Zone City', 14, $today, 'oldguard', 'officer'],
                ['npc-iron-enforcer', 'Marrow', 29, 21900, 310000, 150, 50, 3200, 1500, 150, 50, 3200, 1500, $now, 5100, 4900, 4400, 4200, 1920000, 'Zone City', 11, $today, 'kings', 'officer'],
                ['npc-oldguard-don', 'BigSal', 26, 17400, 245000, 140, 50, 2900, 1500, 140, 50, 2900, 1500, $now, 4200, 3800, 3100, 2950, 1450000, 'Zone City', 9, $today, 'oldguard', 'leader'],
                ['npc-velvet-queen', 'Lady_Vega', 23, 14200, 198000, 140, 50, 2600, 1000, 140, 50, 2600, 1000, $now, 3100, 2900, 3650, 3400, 1120000, 'Zone City', 8, $today, 'night', 'officer'],
                ['npc-crown-capo', 'K1ng', 20, 11300, 164000, 130, 45, 2350, 1000, 130, 45, 2350, 1000, $now, 2650, 2400, 2550, 2300, 840000, 'Zone City', 7, $today, 'vipers', 'officer'],
                ['npc-night-broker', 'NadiaQuick', 17, 8650, 128000, 120, 45, 2050, 750, 120, 45, 2050, 1000, $now, 1850, 1650, 2400, 2150, 620000, 'Zone City', 6, $today, 'night', 'leader'],
                ['npc-dock-ghost', 'Silas', 15, 6900, 96000, 120, 45, 1850, 500, 120, 45, 1850, 500, $now, 1540, 1480, 1620, 1590, 410000, 'Zone City', 5, $today, 'kings', 'member'],
                ['npc-harbor-king', 'Rayan_Black', 13, 5240, 78000, 120, 45, 1650, 450, 120, 45, 1650, 500, $now, 1280, 1140, 1220, 1090, 290000, 'Zone City', 4, $today, 'kings', 'leader'],
                ['npc-shadow-fixer', 'Kaya_V', 11, 3980, 62000, 110, 45, 1450, 450, 110, 45, 1450, 500, $now, 940, 880, 1050, 980, 185000, 'Zone City', 4, $today, 'night', 'member'],
                ['npc-viper-lieutenant', 'Omar_Z', 9, 2850, 48000, 110, 45, 1250, 350, 110, 45, 1250, 500, $now, 680, 640, 710, 660, 115000, 'Zone City', 3, $today, 'vipers', 'officer'],
                ['npc-north-enforcer', 'Tariq', 7, 1820, 34000, 100, 40, 1050, 350, 100, 40, 1050, 350, $now, 430, 410, 450, 390, 68000, 'Zone City', 2, $today, 'vipers', 'member'],
                ['npc-alley-medic', 'Noor', 5, 980, 21000, 100, 35, 850, 250, 100, 35, 850, 250, $now, 240, 260, 255, 270, 35000, 'Zone City', 2, $today, 'oldguard', 'member'],
            ];
            foreach ($rivals as $rival) {
                $factionId = $rival[22];
                $role = $rival[23];
                $this->insertIgnore(
                    'players',
                    ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
                    array_slice($rival, 0, 22),
                );
                $this->insertIgnore('faction_members', ['player_id', 'faction_id', 'role', 'joined_at'], [$rival[0], $factionId, $role, $now]);
            }
            foreach ([
                ['vipers', 18500, ['gymBoost' => 1, 'crimeBoost' => 1]],
                ['kings', 14200, ['crimeBoost' => 1]],
                ['night', 11900, ['marketDiscount' => 1]],
                ['oldguard', 16400, ['gymBoost' => 1]],
            ] as [$fid, $respect, $ups]) {
                $this->insertIgnore('family_progression', ['faction_id', 'respect', 'upgrades_json', 'version', 'updated_at'], [$fid, $respect, json_encode($ups, JSON_THROW_ON_ERROR), 1, $now]);
            }
            foreach ([
                ['seed-mkt-medkit', 'npc-night-broker', 'medkit', ['id' => 'medkit', 'name' => 'First Aid Kit', 'type' => 'medical', 'price' => 4500, 'life' => 120], 4, 4200],
                ['seed-mkt-drink', 'npc-harbor-king', 'drink', ['id' => 'drink', 'name' => 'Energy Drink', 'type' => 'booster', 'price' => 3200, 'energy' => 25], 6, 2900],
                ['seed-mkt-vest', 'npc-oldguard-don', 'vest', ['id' => 'vest', 'name' => 'Light Kevlar Vest', 'type' => 'armor', 'price' => 16000], 2, 14800],
            ] as [$lid, $sellerId, $itemId, $itemMeta, $qty, $unitPrice]) {
                $this->insertIgnore(
                    'player_market_listings',
                    ['id', 'seller_id', 'item_id', 'item_json', 'quantity', 'unit_price', 'state', 'version', 'created_at', 'updated_at'],
                    [$lid, $sellerId, $itemId, json_encode($itemMeta, JSON_THROW_ON_ERROR), $qty, $unitPrice, 'active', 1, $now, $now],
                );
            }
            $seasonId = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->modify('monday this week')->setTime(0, 0)->format('o-\WW');
            foreach ([['vipers', 485], ['kings', 440], ['oldguard', 395], ['night', 360]] as [$fid, $score]) {
                $this->insertIgnore('family_competition_scores', ['season_id', 'faction_id', 'score', 'version', 'updated_at'], [$seasonId, $fid, $score, 1, $now]);
            }
            $this->execute("INSERT INTO engine_metadata (name, value) VALUES ('vercel-ephemeral-seed-v1', '1') ON CONFLICT (name) DO UPDATE SET value = '1'");
        });
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

        // Existing game variants are migrated as draft content without
        // overwriting an administrator's edits or an active release.
        $variants = json_decode((string) file_get_contents(ZONE_ENGINE_ROOT . '/data/crimes.json'), true, 64, JSON_THROW_ON_ERROR);
        foreach ($variants as $crime) {
            $this->insertIgnore('crimes',
                ['id', 'name_en', 'name_ar', 'nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward', 'level_required', 'enabled'],
                [$crime['id'], $crime['name_en'], $crime['name_ar'], $crime['nerve_cost'], $crime['success_basis_points'], $crime['cash_min'], $crime['cash_max'], $crime['xp_reward'], $crime['level_required'], 1]);
        }

        // Server-clock cooldown floors (seconds), owned as config not code.
        // Bank stays at 0 (balance-gated); the rate limiter still covers it.
        $cooldowns = [
            'crime' => 5, 'attack' => 8, 'gym' => 3, 'job' => 10,
            'blackjack' => 3, 'travel' => 15, 'hospital' => 5, 'bank' => 0, 'territory' => 1,
        ];
        foreach ($cooldowns as $action => $seconds) {
            $this->insertIgnore('cooldown_config', ['action', 'seconds'], [$action, $seconds]);
        }

        $this->seedTerritoryFoundation($now);
    }

    /**
     * Seed a dense 120-block city graph. Geometry is stored as real longitude /
     * latitude polygons so the renderer and every future client consume the
     * same server-owned topology instead of inventing visual-only districts.
     */
    private function seedTerritoryFoundation(string $now): void
    {
        $factions = [
            ['vipers', 'Sand Vipers', 'أفاعي الرمل', '#78d628'],
            ['kings', 'Harbor Kings', 'ملوك المرفأ', '#3d7cc9'],
            ['night', 'Night Market', 'السوق الليلي', '#b8529e'],
            ['oldguard', 'Old Guard', 'الحرس القديم', '#d99332'],
        ];
        foreach ($factions as $faction) {
            $this->insertIgnore('factions', ['id', 'name_en', 'name_ar', 'color', 'enabled'], [...$faction, 1]);
        }
        $this->insertIgnore('faction_members', ['player_id', 'faction_id', 'role', 'joined_at'], ['founder-player', 'vipers', 'leader', $now]);

        // Serverless requests construct the engine repeatedly. Once the full
        // immutable v1 catalog exists, do not issue 240 conflict-only inserts
        // on every request. Live ownership remains untouched either way.
        $seeded = $this->fetchOne('SELECT COUNT(*) AS total FROM territory_blocks');
        if ((int) ($seeded['total'] ?? 0) >= 120) {
            return;
        }

        $columns = 12;
        $rows = 10;
        $benefits = [
            ['cash_income', 'Cash flow', 'تدفق نقدي', 18000, 'cash/hour'],
            ['crime_bonus', 'Crime success', 'نجاح الجرائم', 350, 'basis-points'],
            ['gym_bonus', 'Gym training', 'تدريب النادي', 300, 'basis-points'],
            ['medical_discount', 'Medical network', 'شبكة طبية', 500, 'basis-points'],
            ['market_discount', 'Market leverage', 'نفوذ السوق', 300, 'basis-points'],
            ['travel_discount', 'Transport corridor', 'ممر نقل', 450, 'basis-points'],
            ['weapon_supply', 'Weapon supply', 'إمداد أسلحة', 12, 'items/day'],
            ['contraband', 'Contraband route', 'طريق تهريب', 9, 'crates/day'],
            ['intel', 'Street intelligence', 'معلومات الشارع', 8, 'percent'],
            ['defense', 'Defensive position', 'موقع دفاعي', 600, 'basis-points'],
            ['recruitment', 'Recruitment reach', 'نطاق التجنيد', 5, 'members'],
        ];
        $sectorMultipliers = [1 => 2.50, 2 => 2.25, 3 => 2.00, 4 => 1.75, 5 => 1.50, 6 => 1.25, 7 => 1.00];
        $sizeMultipliers = [1 => 1.00, 2 => 1.25, 3 => 1.50, 4 => 1.75, 5 => 2.00];
        $densityMultipliers = [1 => 1.00, 2 => 2.00, 3 => 3.00];

        for ($row = 0; $row < $rows; $row++) {
            for ($column = 0; $column < $columns; $column++) {
                $ordinal = $row * $columns + $column + 1;
                $id = sprintf('ZC-%03d', $ordinal);
                $polygon = [
                    $this->territoryPoint($column, $row, $columns, $rows),
                    $this->territoryPoint($column + 1, $row, $columns, $rows),
                    $this->territoryPoint($column + 1, $row + 1, $columns, $rows),
                    $this->territoryPoint($column, $row + 1, $columns, $rows),
                ];
                $centroid = [
                    array_sum(array_column($polygon, 0)) / count($polygon),
                    array_sum(array_column($polygon, 1)) / count($polygon),
                ];
                $neighbors = [];
                foreach ([[-1, 0], [1, 0], [0, -1], [0, 1]] as [$dx, $dy]) {
                    $neighborColumn = $column + $dx;
                    $neighborRow = $row + $dy;
                    if ($neighborColumn >= 0 && $neighborColumn < $columns && $neighborRow >= 0 && $neighborRow < $rows) {
                        $neighbors[] = sprintf('ZC-%03d', $neighborRow * $columns + $neighborColumn + 1);
                    }
                }

                $normalizedX = (($column + 0.5) / $columns) * 2 - 1;
                $normalizedY = (($row + 0.5) / $rows) * 2 - 1;
                $radius = max(abs($normalizedX), abs($normalizedY));
                $sector = min(7, max(1, 1 + (int) floor($radius * 7)));
                $sizeTier = 1 + (($ordinal * 7 + $row) % 5);
                $densityTier = min(3, max(1, 4 - (int) ceil($sector / 3) + (($column + $row) % 3 === 0 ? 1 : 0)));
                $wallSlots = min(30, 5 + $sizeTier * 5);
                $dailyRespect = (int) round(15 * $sectorMultipliers[$sector] * $sizeMultipliers[$sizeTier] * $densityMultipliers[$densityTier]);
                $benefit = $benefits[($ordinal + $row * 3 + $column) % count($benefits)];
                if ($row === 4 && $column === 4) {
                    $benefit = $benefits[2]; // Sand Vipers: gym training advantage.
                } elseif ($row === 4 && $column === 5) {
                    $benefit = $benefits[1]; // Sand Vipers: crime success advantage.
                } elseif ($row === 4 && $column === 6) {
                    $benefit = $benefits[5]; // Sand Vipers: travel-time advantage.
                }
                $district = match (true) {
                    $row <= 2 => 'north',
                    $row >= 7 && $column <= 5 => 'red',
                    $row >= 7 => 'res',
                    $column <= 3 => 'west',
                    $column >= 8 => 'fin',
                    default => 'center',
                };

                $this->insertIgnore(
                    'territory_blocks',
                    ['id', 'district_id', 'name_en', 'name_ar', 'polygon_json', 'centroid_json', 'neighbors_json', 'sector', 'size_tier', 'density_tier', 'wall_slots', 'daily_respect', 'benefit_key', 'benefit_name_en', 'benefit_name_ar', 'benefit_value', 'benefit_unit', 'enabled', 'definition_version'],
                    [$id, $district, "Block {$id}", "القطاع {$id}", json_encode($polygon, JSON_THROW_ON_ERROR), json_encode($centroid, JSON_THROW_ON_ERROR), json_encode($neighbors, JSON_THROW_ON_ERROR), $sector, $sizeTier, $densityTier, $wallSlots, $dailyRespect, $benefit[0], $benefit[1], $benefit[2], $benefit[3], $benefit[4], 1, 1],
                );

                [$owner, $state, $control] = $this->seedTerritoryControl($row, $column);
                $this->insertIgnore(
                    'territory_control',
                    ['territory_id', 'faction_id', 'state', 'control_basis_points', 'version', 'captured_at', 'updated_at'],
                    [$id, $owner, $state, $control, 1, $owner === null ? null : $now, $now],
                );
            }
        }
    }

    /** @return array{0: float, 1: float} */
    private function territoryPoint(int $column, int $row, int $columns, int $rows): array
    {
        $x = ($column / $columns) * 2 - 1;
        $y = 1 - ($row / $rows) * 2;
        $widthScale = 0.68 + 0.32 * (1 - abs($y));
        // Shared deterministic intersection jitter breaks the spreadsheet-grid
        // silhouette while preserving perfectly matching borders and adjacency.
        $crossJitter = $column > 0 && $column < $columns ? sin($column * 1.91 + $row * 0.73) * 105 : 0;
        $longJitter = $row > 0 && $row < $rows ? sin($row * 1.47 + $column * 0.61) * 135 : 0;
        $crossMeters = $x * 2850 * $widthScale + $crossJitter;
        $longMeters = $y * 5900 + $longJitter;
        $bearing = deg2rad(29);
        $eastMeters = $crossMeters * cos($bearing) + $longMeters * sin($bearing);
        $northMeters = -$crossMeters * sin($bearing) + $longMeters * cos($bearing);
        $centerLatitude = 40.7562;
        $centerLongitude = -73.9812;
        return [
            round($centerLongitude + $eastMeters / (111320 * cos(deg2rad($centerLatitude))), 7),
            round($centerLatitude + $northMeters / 111320, 7),
        ];
    }

    /** @return array{0: ?string, 1: string, 2: int} */
    private function seedTerritoryControl(int $row, int $column): array
    {
        if ($row >= 4 && $row <= 5 && $column >= 4 && $column <= 6) {
            return ['vipers', 'owned', 10000];
        }
        if ($row === 4 && $column === 7) {
            return ['kings', 'contested', 5200];
        }
        if ($row >= 2 && $row <= 4 && $column >= 8 && $column <= 10) {
            return ['kings', 'owned', 10000];
        }
        if ($row >= 7 && $row <= 8 && $column >= 8 && $column <= 10) {
            return ['night', 'owned', 10000];
        }
        if ($row >= 1 && $row <= 2 && $column >= 1 && $column <= 3) {
            return ['oldguard', 'owned', 10000];
        }
        return [null, 'neutral', 0];
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
        if ($this->pdo->inTransaction()) {
            $savepoint = 'zone_nested_' . ++$this->savepointSequence;
            $this->pdo->exec("SAVEPOINT {$savepoint}");
            try {
                $result = $callback($this);
                $this->pdo->exec("RELEASE SAVEPOINT {$savepoint}");
                return $result;
            } catch (Throwable $exception) {
                $this->pdo->exec("ROLLBACK TO SAVEPOINT {$savepoint}");
                $this->pdo->exec("RELEASE SAVEPOINT {$savepoint}");
                throw $exception;
            }
        }
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

    /** Acquire every participant row in one canonical order before shared settlement. */
    public function playersTransaction(array $playerIds, callable $callback): mixed
    {
        $ids = array_values(array_unique($playerIds));
        if ($ids === [] || count($ids) > 100) throw new RuntimeException('Invalid participant set.');
        foreach ($ids as $id) if (!is_string($id) || $id === '') throw new RuntimeException('Invalid participant identity.');
        sort($ids, SORT_STRING);
        return $this->transaction(function () use ($ids, $callback): mixed {
            foreach ($ids as $id) {
                if ($this->driver === 'sqlite') $this->execute('UPDATE players SET id=id WHERE id=:id', ['id'=>$id]);
                if ($this->fetchOne('SELECT id FROM players WHERE id=:id' . ($this->driver === 'pgsql' ? ' FOR UPDATE' : ''), ['id'=>$id]) === null) throw new RuntimeException('Unknown participant.');
            }
            return $callback($this);
        });
    }

    /** Serialize every authoritative mutation before reading this player's state. */
    public function playerTransaction(string $playerId, callable $callback): mixed
    {
        return $this->transaction(function () use ($playerId, $callback): mixed {
            if ($this->driver === 'sqlite') {
                // SQLite has no row locks. Acquire its write lock before any
                // balance reads rather than upgrading a stale read snapshot.
                $this->execute('UPDATE players SET id = id WHERE id = :id', ['id' => $playerId]);
            }
            $player = $this->fetchOne(
                'SELECT id FROM players WHERE id = :id' . ($this->driver === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $playerId],
            );
            if ($player === null) {
                throw new RuntimeException("Unknown player: {$playerId}");
            }
            return $callback($this);
        });
    }
}

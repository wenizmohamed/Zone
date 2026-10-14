<?php
declare(strict_types=1);

// One-time local migration. Never accepts cloud URLs or replaces a populated target.
require dirname(__DIR__) . '/bootstrap.php';
$configFile = ZONE_REPOSITORY_ROOT . '/.tools/local-beta-config.json';
$config = json_decode((string) file_get_contents($configFile), true, 512, JSON_THROW_ON_ERROR);
$parts = parse_url($config['databaseUrl']);
if (!in_array($parts['scheme'] ?? '', ['postgres', 'postgresql'], true)
    || ($parts['host'] ?? '') !== '127.0.0.1' || ($parts['path'] ?? '') !== '/zone_local_beta'
    || ($parts['port'] ?? null) !== 55433 || ($parts['user'] ?? '') !== 'zone_local_app'
    || ($config['databasePort'] ?? null) !== 55433) throw new RuntimeException('Only the dedicated local beta database and role on port 55433 are allowed.');
$sourceFile = realpath($argv[1] ?? '');
if (!$sourceFile || !str_starts_with($sourceFile, realpath(ZONE_ENGINE_ROOT . '/var') . DIRECTORY_SEPARATOR)) throw new RuntimeException('Source must be an existing local engine database.');
$source = new PDO('sqlite:' . $sourceFile, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$directory = ZONE_REPOSITORY_ROOT . '/.tools/local-beta-backups';
if (!is_dir($directory)) mkdir($directory, 0700, true);
$snapshot = $directory . '/before-postgres-' . gmdate('Ymd-His') . '.sqlite';
$source->exec('VACUUM INTO ' . $source->quote($snapshot));
$source = new PDO('sqlite:' . $snapshot, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$destination = new PDO(sprintf('pgsql:host=127.0.0.1;port=%d;dbname=zone_local_beta;sslmode=disable', $parts['port']), urldecode($parts['user']), urldecode($parts['pass']), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$existing = $destination->query("SELECT to_regclass('public.players')")->fetchColumn();
if ($existing && (int) $destination->query('SELECT COUNT(*) FROM players')->fetchColumn() > 0) throw new RuntimeException('Destination has players. Migration refuses to overwrite it.');
$sql = (string) file_get_contents(ZONE_ENGINE_ROOT . '/database/schema.postgresql.sql');
preg_match_all('/CREATE TABLE IF NOT EXISTS ([a-z_]+)/', $sql, $matches);
$tables = array_unique($matches[1]);
$sourceTables = $source->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);
$unknown = array_diff($sourceTables, $tables, ['engine_metadata']);
if ($unknown) throw new RuntimeException('Unmapped source tables: ' . implode(', ', $unknown));
$counts = [];
$destination->beginTransaction();
try {
    $destination->exec($sql);
    foreach ($tables as $table) {
        if (!in_array($table, $sourceTables, true)) continue;
        $rows = $source->query('SELECT * FROM "' . $table . '"')->fetchAll(PDO::FETCH_ASSOC);
        if ($rows) {
            $columns = array_keys($rows[0]);
            $quoted = array_map(static fn(string $column): string => '"' . $column . '"', $columns);
            $insert = $destination->prepare('INSERT INTO "' . $table . '" (' . implode(',', $quoted) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')');
            foreach ($rows as $row) $insert->execute(array_values($row));
        }
        $actual = (int) $destination->query('SELECT COUNT(*) FROM "' . $table . '"')->fetchColumn();
        if ($actual !== count($rows)) throw new RuntimeException('Count mismatch: ' . $table);
        $counts[$table] = $actual;
    }
    $destination->commit();
} catch (Throwable $error) {
    $destination->rollBack();
    throw $error;
}
// Seed additive new features without replacing migrated player/world rows.
$engine = zone_engine($config['databaseUrl']);
$report = ['createdAt' => gmdate(DATE_ATOM), 'source' => $sourceFile, 'snapshot' => $snapshot, 'snapshotSha256' => hash_file('sha256', $snapshot), 'database' => 'zone_local_beta', 'tables' => $counts, 'verified' => true];
$reportFile = ZONE_REPOSITORY_ROOT . '/docs/analysis/beta-final-20261009/local-database-migration.json';
file_put_contents($reportFile, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
echo 'PASS: ' . count($counts) . ' tables migrated transactionally; all row counts match; source preserved.' . PHP_EOL;
echo 'Evidence: ' . $reportFile . PHP_EOL;

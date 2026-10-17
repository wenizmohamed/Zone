<?php
declare(strict_types=1);

// Tracked, direct-PDO migration proof primitives shared by isolated tests and
// the private PC controller wrapper. No PC paths, credentials, CLI entry, seeders
// or engine bootstrap live here. The wrapper owns target and approval guards.
const B110_BASELINE = ['pgsql' => '36bfb1328718b31d94baedc73335e4f5d43af14377308489ea28d28f9fce9d99', 'sqlite' => '33670b46c937a8160e48f1b75f5803f4b9f72ec54c079539858b31d376836894'];
const B110_SQL = <<<'SQL'
-- beta110: append-only issuance is retained independently of owned stock/finds.
CREATE TABLE IF NOT EXISTS material_issuance (
    source VARCHAR(16) NOT NULL CHECK (source IN ('world','search')),
    correlation_id VARCHAR(100) NOT NULL,
    scope_id VARCHAR(100) NOT NULL,
    hour_start BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL CHECK (status IN ('awarded','budget-capped','no-eligible-material')),
    item_id VARCHAR(80),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_value BIGINT NOT NULL CHECK (unit_value >= 0),
    issued_value BIGINT NOT NULL CHECK (issued_value >= 0),
    release_id VARCHAR(100) NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (source,correlation_id),
    CHECK (status <> 'awarded' OR item_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS material_issuance_hour ON material_issuance(source,scope_id,hour_start);
SQL;

function b110Bytes(string $path): string { $bytes = @file_get_contents($path); if ($bytes === false) throw new RuntimeException('Required source bytes are unavailable.'); return $bytes; }
function b110Norm(string $bytes): string { return rtrim(str_replace("\r\n", "\n", $bytes), "\n") . "\n"; }
function b110Schema(string $path, string $driver): string {
    $sql = b110Norm(b110Bytes($path)); $marker = strpos($sql, '-- beta110: append-only issuance');
    if ($marker === false || hash('sha256', b110Norm(substr($sql, 0, $marker))) !== B110_BASELINE[$driver]
        || b110Norm(substr($sql, $marker)) !== b110Norm(B110_SQL)) throw new RuntimeException('Only the exact beta109 baseline plus one reviewed beta110 table/index is permitted.');
    return b110Norm(substr($sql, 0, $marker));
}
function b110Identifier(string $name): string { if (!preg_match('/^[a-z_][a-z0-9_]*$/D', $name)) throw new RuntimeException('Unexpected schema identifier.'); return '"' . $name . '"'; }
function b110Tables(PDO $pdo): array {
    return $pdo->query($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql' ? "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" : "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
}
function b110Objects(PDO $pdo): array {
    return $pdo->query($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql' ? "SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','i') ORDER BY c.relname" : "SELECT name,CASE type WHEN 'table' THEN 'r' ELSE 'i' END FROM sqlite_master WHERE type IN ('table','index') ORDER BY name")->fetchAll(PDO::FETCH_KEY_PAIR);
}
function b110Fingerprint(PDO $pdo): string {
    $value = $pdo->query("SELECT value FROM engine_metadata WHERE name='schema-fingerprint'")->fetchColumn();
    if (!is_string($value) || !preg_match('/^[a-f0-9]{64}$/D', $value)) throw new RuntimeException('Existing schema bookkeeping is unavailable.'); return $value;
}
function b110Release(PDO $pdo): array {
    $rows = $pdo->query('SELECT id,version FROM content_releases WHERE active=1')->fetchAll(PDO::FETCH_ASSOC);
    if (count($rows) !== 1) throw new RuntimeException('Exactly one active release is required for a preservation snapshot.');
    return ['id' => $rows[0]['id'], 'version' => (int)$rows[0]['version']];
}
function b110Snapshot(PDO $pdo, array $tables): array {
    $counts = []; $digests = [];
    foreach ($tables as $table) {
        $filter = $table === 'engine_metadata' ? " WHERE name<>'schema-fingerprint'" : '';
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql') {
            $row = $pdo->query('SELECT COUNT(*) AS total,md5(COALESCE(string_agg(row_hash,\'\' ORDER BY row_hash),\'\')) AS digest FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public.' . b110Identifier($table) . ' t' . $filter . ') frozen')->fetch(PDO::FETCH_ASSOC);
            $counts[$table] = (int)$row['total']; $digests[$table] = $row['digest'];
        } else {
            $hashes = []; foreach ($pdo->query('SELECT * FROM ' . b110Identifier($table) . $filter)->fetchAll(PDO::FETCH_ASSOC) as $row) $hashes[] = hash('sha256', json_encode($row, JSON_THROW_ON_ERROR));
            sort($hashes,SORT_STRING); $counts[$table] = count($hashes); $digests[$table] = hash('sha256',implode('', $hashes));
        }
    }
    return ['counts' => $counts, 'digests' => $digests, 'activeRelease' => b110Release($pdo)];
}
function b110Absent(PDO $pdo): void { $objects = b110Objects($pdo); foreach (['material_issuance','material_issuance_hour'] as $name) if (isset($objects[$name])) throw new RuntimeException('A beta110 object already exists; blind adoption is refused.'); }
function b110Prepare(PDO $pdo, string $before, string $after): array {
    $pdo->beginTransaction(); $tables = b110Tables($pdo);
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql') {
        $pdo->query('SELECT pg_advisory_xact_lock(90120261005)');
        $pdo->exec('LOCK TABLE ' . implode(',',array_map('b110Identifier',$tables)) . ' IN SHARE MODE');
    } else $pdo->exec("UPDATE engine_metadata SET value=value WHERE name='schema-fingerprint'");
    if (!hash_equals($before,b110Fingerprint($pdo))) throw new RuntimeException('Stored fingerprint no longer matches exact deployed SQL/crime bytes.');
    b110Absent($pdo); $snapshot = b110Snapshot($pdo,$tables); $pdo->exec(B110_SQL); $objects = b110Objects($pdo);
    if (($objects['material_issuance'] ?? '') !== 'r' || ($objects['material_issuance_hour'] ?? '') !== 'i') throw new RuntimeException('Reviewed additive objects were not created.');
    return ['phase' => 'prepared','transactionHeld' => true,'snapshotBefore' => $snapshot,'fingerprintBefore' => $before,'fingerprintAfter' => $after,'tables' => $tables,'seedCalled' => false];
}
function b110Commit(PDO $pdo, array $prepared, string $schema, string $crimes): array {
    if (!hash_equals($prepared['fingerprintAfter'],hash('sha256',b110Bytes($schema) . b110Bytes($crimes)))) throw new RuntimeException('Exact installed schema/crime bytes do not match the reviewed fingerprint.');
    $after = b110Snapshot($pdo,$prepared['tables']);
    if ($after !== $prepared['snapshotBefore']) throw new RuntimeException('Existing data or active release changed during installation.');
    $statement = $pdo->prepare("UPDATE engine_metadata SET value=:new WHERE name='schema-fingerprint' AND value=:old");
    $statement->execute(['new' => $prepared['fingerprintAfter'],'old' => $prepared['fingerprintBefore']]);
    if ($statement->rowCount() !== 1) throw new RuntimeException('Fingerprint compare-and-swap failed.');
    $pdo->commit(); return ['phase' => 'committed','dataPreserved' => true,'snapshotAfter' => $after,'fingerprint' => $prepared['fingerprintAfter'],'seedCalled' => false];
}

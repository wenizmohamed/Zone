<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Counts application result bytes, not wire traffic or TLS overhead. */
class CatalogEgressStatement extends PDOStatement
{
    public static int $bytes = 0;
    public static int $reads = 0;
    protected function __construct() {}
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed
    {
        $result = parent::fetch($mode, $cursorOrientation, $cursorOffset);
        self::$reads++;
        self::$bytes += strlen(json_encode($result, JSON_THROW_ON_ERROR));
        return $result;
    }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array
    {
        $result = parent::fetchAll($mode, ...$args);
        self::$reads++;
        self::$bytes += strlen(json_encode($result, JSON_THROW_ON_ERROR));
        return $result;
    }
}

$url = getenv('ZONE_POSTGRES_EGRESS_TEST_URL') ?: 'sqlite::memory:';
if ($url !== 'sqlite::memory:') {
    $target = parse_url($url);
    if (!is_array($target) || !in_array($target['host'] ?? '', ['127.0.0.1', 'localhost'], true)
        || !preg_match('~^/zone_beta_smoke_[0-9a-z_]+$~D', $target['path'] ?? '')) throw new RuntimeException('An isolated loopback PostgreSQL test database is required.');
}
$engine = zone_engine($url);
$engine->publishRelease('catalog-egress-test');
$expectedStatus = $engine->status();
$db = (new ReflectionProperty($engine, 'database'))->getValue($engine);
$catalog = new GameplayCatalog($db, new EventBus($db));
$expected = $catalog->active();
$manifest = $db->fetchOne('SELECT manifest_json FROM content_releases WHERE active = 1 LIMIT 1');
$fullBytes = strlen(json_encode($manifest, JSON_THROW_ON_ERROR));
$pdo = (new ReflectionProperty($db, 'pdo'))->getValue($db);
$pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [CatalogEgressStatement::class, []]);
$actual = $catalog->active();
$bytes = CatalogEgressStatement::$bytes;
$reads = CatalogEgressStatement::$reads;
echo json_encode(['driver' => $db->driver(), 'fullReleaseResultBytes' => $fullBytes, 'activeCatalogResultBytes' => $bytes, 'catalogReads' => $reads], JSON_THROW_ON_ERROR) . PHP_EOL;
$passed = 0;
function egressProof(bool $ok, string $message): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $message); $passed++; echo 'PASS: ' . $message . PHP_EOL; }
egressProof($actual === $expected, 'catalog projection preserves every published gameplay definition');
egressProof($bytes < $fullBytes / 2, 'catalog-only read does not transfer the unrelated city and page manifest');
if ($db->driver() === 'sqlite') {
    $db->execute("CREATE TRIGGER reject_repeated_catalog_init BEFORE INSERT ON gameplay_catalogs BEGIN SELECT RAISE(ABORT, 'repeated catalog initialization'); END");
} else {
    $db->execute("CREATE OR REPLACE FUNCTION reject_repeated_catalog_init() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'repeated catalog initialization'; END; $$ LANGUAGE plpgsql");
    $db->execute('CREATE TRIGGER reject_repeated_catalog_init BEFORE INSERT ON gameplay_catalogs FOR EACH ROW EXECUTE FUNCTION reject_repeated_catalog_init()');
}
$catalog->active();
egressProof(true, 'established active catalog never retries seed or draft inserts');
CatalogEgressStatement::$bytes = 0;
CatalogEgressStatement::$reads = 0;
$status = $engine->status();
echo json_encode(['statusResultBytes' => CatalogEgressStatement::$bytes, 'statusReads' => CatalogEgressStatement::$reads], JSON_THROW_ON_ERROR) . PHP_EOL;
egressProof($status === $expectedStatus, 'lightweight health retains release, theme and module status');
egressProof(CatalogEgressStatement::$bytes < $fullBytes / 2, 'health does not read the full immutable city release');
$release = $engine->activeRelease();
$legacyManifest = $release['manifest'];
unset($legacyManifest['content']);
$db->execute('UPDATE content_releases SET manifest_json = :manifest WHERE id = :id', ['manifest' => json_encode($legacyManifest, JSON_THROW_ON_ERROR), 'id' => $release['id']]);
try {
    egressProof($engine->status()['activeTheme'] === $expectedStatus['activeTheme'], 'legacy release summary inherits the immutable foundation theme');
} finally {
    $db->execute('UPDATE content_releases SET manifest_json = :manifest WHERE id = :id', ['manifest' => json_encode($release['manifest'], JSON_THROW_ON_ERROR), 'id' => $release['id']]);
}
echo "CATALOG EGRESS RESULT: {$passed} passed, 0 failed\n";

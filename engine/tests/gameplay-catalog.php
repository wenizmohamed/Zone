<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ProgressionService;

$path = ZONE_ENGINE_ROOT . '/var/catalog-' . bin2hex(random_bytes(6)) . '.sqlite';
$engine = zone_engine('sqlite:' . $path);
$db = Database::connect('sqlite:' . $path);
$passed = 0;
function catalogProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function catalogReject(callable $call, string $prefix): bool { try { $call(); } catch (Throwable $error) { return str_starts_with($error->getMessage(), $prefix); } return false; }
function editCatalog(string $category, string $id, array $changes): array { global $engine; return $engine->saveGameplayCatalog($category, $id, $changes, $engine->adminGameplayCatalog()['revision'], 'catalog-test'); }
function catalogAction(string $action, string $id): array { global $engine; $state = $engine->gameplay(); return $engine->gameplayAction($action, $id, $state['state']['version']); }
try {
    $before = $engine->gameplay();
    $initial = $engine->adminGameplayCatalog();
    catalogProof(count($initial['schema']) === 8 && $initial['revision'] === 1 && count($initial['catalogs']['items']) === 58, 'typed catalog exposes eight editable categories and preserved stable entries');
    $edited = editCatalog('items', 'drink', ['price' => 123, 'name' => ['en' => 'Cold Drink', 'ar' => 'مشروب بارد']]);
    catalogProof($edited['revision'] === 2 && $edited['catalogs']['items']['drink']['price'] === 123, 'catalog edit persists typed values and increments draft revision');
    catalogProof($engine->gameplay()['catalogs']['items']['drink']['price'] === 990, 'unpublished catalog edit cannot change initial runtime price');
    catalogProof($engine->gameBootstrap()['content']['gameplayCatalog']['items']['drink']['price'] === 990, 'initial bootstrap reads frozen catalog foundation');
    catalogProof(catalogReject(fn () => $engine->saveGameplayCatalog('items', 'drink', ['price' => 456], 1, 'stale'), 'Gameplay catalog changed.'), 'stale admin catalog revision rejects overwrite');
    foreach ([['price' => -1], ['price' => 1.5], ['price' => '123'], ['price' => true], ['type' => 'weapon'], ['id' => 'other'], ['mult' => 2], ['name' => ['en' => '<script>', 'ar' => 'اسم']], ['name' => ['en' => 'Name']], ['name' => ['en' => str_repeat('x', 121), 'ar' => 'اسم']]] as $changes) {
        catalogProof(catalogReject(fn () => editCatalog('items', 'drink', $changes), ''), 'invalid type, range, identity or unsupported field rejected: ' . implode(',', array_keys($changes)));
    }
    catalogProof($engine->adminGameplayCatalog()['revision'] === 2, 'rejected edits do not advance the draft revision');
    catalogProof(catalogReject(fn () => editCatalog('items', 'missing-item', ['price' => 1]), 'Unknown catalog entry.'), 'catalog cannot introduce untracked item IDs');
    $one = $engine->publishRelease('catalog-test');
    catalogProof($one['manifest']['content']['gameplayCatalog']['items']['drink']['price'] === 123, 'publication snapshots the typed gameplay catalog');
    catalogProof(catalogReject(fn () => $engine->gameplayAction('item.buy', 'drink', $before['state']['version']), 'Progression state changed.'), 'published catalog change invalidates a previously quoted purchase view');
    $current = $engine->gameplay();
    $bought = $engine->gameplayAction('item.buy', 'drink', $current['state']['version']);
    catalogProof($bought['player']['cash'] === $current['player']['cash'] - 123 && $bought['state']['inv']['drink'] === $current['state']['inv']['drink'] + 1, 'actual item purchase debits the published price exactly once');
    catalogProof($bought['catalogs']['items']['drink']['name']['ar'] === 'مشروب بارد', 'bilingual published name reaches authoritative client snapshot');
    editCatalog('items', 'drink', ['price' => 321]);
    catalogProof($engine->gameplay()['catalogs']['items']['drink']['price'] === 123, 'later draft changes preserve active price');
    $engine->publishRelease('catalog-test');
    catalogProof($engine->gameplay()['catalogs']['items']['drink']['price'] === 321, 'next publish activates the next economic value');
    $engine->activateRelease($one['id'], 'catalog-test');
    catalogProof($engine->gameplay()['catalogs']['items']['drink']['price'] === 123, 'rollback restores exact prior gameplay catalog');
    $engine = zone_engine('sqlite:' . $path);
    catalogProof($engine->gameplay()['catalogs']['items']['drink']['price'] === 123, 'catalog rollback persists across fresh engine instances');
    editCatalog('jobs', 'grocer', ['pay' => 246, 'energy' => 3]);
    editCatalog('gyms', '2', ['e' => 7]);
    editCatalog('courses', 'bio', ['cost' => 18, 'mins' => 2]);
    editCatalog('properties', 'trailer', ['price' => 21, 'happy' => 777]);
    editCatalog('upgrades', 'gymBoost', ['cost' => 8]);
    editCatalog('missions', 'c5', ['n' => 1, 'cash' => 77, 'pts' => 2]);
    editCatalog('opponents', 'rayan', ['life' => 111, 'str' => 13]);
    editCatalog('items', 'armor', ['red' => .4]);
    $all = $engine->publishRelease('catalog-test');
    $db->execute("UPDATE players SET energy = 150, last_login_day = :day WHERE id = 'founder-player'", ['day' => gmdate('Y-m-d')]);
    $job = $engine->workShift();
    catalogProof($job['reward']['cash'] === 246 && $job['cost']['energy'] === 3, 'published job pay and energy drive real work settlement');
    catalogProof($engine->trainGym('strength')['cost']['energy'] === 7, 'published gym energy drives actual training');
    $course = catalogAction('course.enroll', 'bio');
    catalogProof($course['result']['cashDelta'] === -18 && $course['state']['edu']['total'] === 120000, 'published course cost and real duration drive enrollment');
    $property = catalogAction('property.buy', 'trailer');
    catalogProof($property['result']['cashDelta'] === -21 && $property['player']['max_happy'] === 777, 'published property price and capacity drive purchase');
    $respect = $property['state']['fac']['respect'];
    $upgrade = catalogAction('faction.upgrade', 'gymBoost');
    catalogProof($upgrade['state']['fac']['respect'] === $respect - 8, 'published upgrade cost drives respect settlement');
    (new ProgressionService($db, new EventBus($db)))->recordCrime('founder-player', 'trash', true);
    catalogProof(catalogAction('mission.claim', 'c5')['result']['cashDelta'] === 77, 'published mission threshold and reward drive one-time claim');
    catalogAction('item.buy', 'armor');
    catalogAction('item.equip', 'armor');
    $fight = $engine->combatAction('start', 'rayan', '', $engine->combat()['version']);
    $stored = json_decode($db->fetchOne("SELECT state_json FROM combat_encounters WHERE player_id = 'founder-player'")['state_json'], true);
    catalogProof($fight['encounter']['enemyMaxHp'] === 111 && $fight['encounter']['opponent']['str'] === 13 && $stored['encounter']['armorReduction'] === .4, 'published opponent and armor values drive a new combat encounter');
    $deadline = $course['state']['edu']['until'];
    editCatalog('courses', 'bio', ['mins' => 5]);
    editCatalog('properties', 'trailer', ['happy' => 555]);
    $engine->publishRelease('catalog-test');
    catalogProof($engine->gameplay()['state']['edu']['until'] === $deadline, 'publishing a duration edit preserves the already enrolled real deadline');
    catalogProof($engine->gameplay()['player']['max_happy'] === 555, 'published property cap changes apply to existing residents');
    $engine->activateRelease($all['id'], 'catalog-test');
    catalogProof($engine->gameplay()['player']['max_happy'] === 777, 'rollback restores the active resident property cap');
    // Simulate an installation release that predates the new catalog snapshot.
    $legacy = $one['manifest']; unset($legacy['content']['gameplayCatalog']);
    $db->execute('UPDATE content_releases SET manifest_json = :manifest WHERE id = :id', ['manifest' => json_encode($legacy), 'id' => $one['id']]);
    $engine->activateRelease($one['id'], 'catalog-test');
    catalogProof($engine->gameplay()['catalogs']['items']['drink']['price'] === 990 && $engine->gameBootstrap()['content']['gameplayCatalog']['items']['drink']['price'] === 990, 'legacy releases fall back to immutable original catalog, never current draft');
    $previous = $engine->adminGameplayCatalog();
    $db->execute("CREATE TRIGGER catalog_event_fault BEFORE INSERT ON event_log WHEN NEW.event_name = 'GameplayCatalogUpdated' BEGIN SELECT RAISE(ABORT, 'catalog test fault'); END");
    catalogProof(catalogReject(fn () => editCatalog('items', 'drink', ['price' => 456]), 'SQLSTATE'), 'catalog event persistence failure surfaces');
    $db->execute('DROP TRIGGER catalog_event_fault');
    catalogProof($engine->adminGameplayCatalog()['revision'] === $previous['revision'] && $engine->adminGameplayCatalog()['catalogs'] === $previous['catalogs'], 'failed event rolls back catalog and revision together');
    catalogProof(count($db->fetchAll("SELECT id FROM admin_audit_log WHERE action = 'GameplayCatalogUpdated'")) === $previous['revision'] - 1, 'each accepted catalog edit has one durable audit record');
    echo "CATALOG RESULT: {$passed} passed, 0 failed\n";
} catch (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL); exit(1); }

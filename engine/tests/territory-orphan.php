<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Territories\TerritoryService;

$url = getenv('ZONE_POSTGRES_ORPHAN_TEST_URL') ?: 'sqlite::memory:';
if ($url !== 'sqlite::memory:') {
    $target = parse_url($url);
    if (!is_array($target) || !in_array($target['host'] ?? '', ['127.0.0.1', 'localhost'], true)
        || !preg_match('~^/zone_beta_smoke_[0-9a-z_]+$~D', $target['path'] ?? '')) throw new RuntimeException('An isolated loopback PostgreSQL test database is required.');
}
$db = Database::connect($url); $db->migrateAndSeed();
$service = new TerritoryService($db, new EventBus($db));
$passed = 0;
function orphanProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
$before = $db->fetchOne("SELECT * FROM territory_control WHERE territory_id = 'ZC-056'");
$map = $service->snapshot('founder-player');
$block = array_column($map['blocks'], null, 'id')['ZC-056'];
orphanProof($block['activeWar'] === null && $block['state'] === 'owned' && $block['ownerFactionId'] === 'kings' && $block['control'] === 52, 'legacy contested label without a war displays actual partial ownership');
orphanProof($block['action'] === 'assault' && $block['actionEnergyCost'] === 25, 'adjacent rival is allowed to start a real assault instead of remaining locked');
orphanProof($db->fetchOne("SELECT * FROM territory_control WHERE territory_id = 'ZC-056'") === $before, 'read reconciliation preserves saved owner, control, version and timestamps');
$energy = (int) $db->fetchOne("SELECT energy FROM players WHERE id = 'founder-player'")['energy'];
$result = $service->act('ZC-056', 'assault', $block['version'], 'founder-player');
$after = array_column($result['map']['blocks'], null, 'id')['ZC-056'];
orphanProof($after['state'] === 'contested' && $after['activeWar'] !== null && $after['activeWar']['attackerFactionId'] === 'vipers' && $after['activeWar']['defenderFactionId'] === 'kings', 'authorized assault creates a real persistent war with the existing defender');
orphanProof($after['activeWar']['attackerScore'] === 50000 && (int) $db->fetchOne("SELECT energy FROM players WHERE id = 'founder-player'")['energy'] === $energy - 25, 'first real contribution and energy cost settle exactly once');
try { $service->act('ZC-056', 'assault', $block['version'], 'founder-player'); orphanProof(false, 'stale orphan request must be rejected'); }
catch (RuntimeException $error) { orphanProof(str_contains($error->getMessage(), 'Territory state changed.'), 'stale orphan request cannot replay the first assault'); }
$db->execute("UPDATE faction_members SET faction_id = 'kings' WHERE player_id = 'founder-player'");
$defender = array_column($service->snapshot('founder-player')['blocks'], null, 'id')['ZC-056'];
orphanProof($defender['state'] === 'contested' && $defender['action'] === 'reinforce', 'real active war still advertises defender reinforcement');
$db->execute("UPDATE faction_members SET faction_id = 'night' WHERE player_id = 'founder-player'");
$third = array_column($service->snapshot('founder-player')['blocks'], null, 'id')['ZC-056'];
orphanProof($third['action'] === null && str_contains($third['actionReason'], 'already active'), 'third faction remains excluded from the real war');
echo "TERRITORY ORPHAN RESULT: {$passed} passed, 0 failed\n";

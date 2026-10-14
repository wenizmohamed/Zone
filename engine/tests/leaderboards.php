<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Modules\Leaderboards\LeaderboardService;

$passed = 0;
function rankingProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
$database = Database::connect('sqlite::memory:'); $database->migrateAndSeed();
for ($i = 0; $i < 55; $i++) {
    $database->execute('INSERT INTO players (id, username, level, cash, bank_balance, strength, defense, speed, dexterity, resources_updated_at) VALUES (:id, :name, :level, :cash, :bank, :strength, 10, 10, 10, :time)', ['id' => sprintf('rank-%02d', $i), 'name' => 'Account ' . $i, 'level' => $i < 2 ? $i + 1 : 1, 'cash' => 2500, 'bank' => 100, 'strength' => $i < 3 ? 100 : 10, 'time' => gmdate('c')]);
}
$database->execute("INSERT INTO faction_members (player_id, faction_id, role, joined_at) VALUES ('rank-01', 'vipers', 'member', :time)", ['time' => gmdate('c')]);
$service = new LeaderboardService($database); $snapshot = $service->snapshot('rank-01');
rankingProof(count($snapshot['rows']) === 50 && $snapshot['limit'] === 50, 'one response is bounded to fifty accounts');
rankingProof(!in_array('Vincenzo', array_column($snapshot['rows'], 'username'), true), 'inflated founder demonstration fixture is not a real player standing');
$top = array_values(array_filter($snapshot['rows'], fn ($row) => str_starts_with($row['username'], 'Account ')));
rankingProof($top[0]['username'] === 'Account 1' && $top[1]['username'] === 'Account 0' && $top[2]['username'] === 'Account 2', 'ties use saved level then stable server account order');
rankingProof($top[0]['totalStats'] === 130 && $top[0]['liquidFunds'] === 2600, 'ranked stats and liquid funds come only from stored values');
rankingProof($top[0]['isCurrentPlayer'] && !$top[1]['isCurrentPlayer'], 'current-account marker cannot mark another account');
rankingProof($top[0]['family']['name']['ar'] !== '' && $top[1]['family'] === null, 'real family names are bilingual and unaffiliated players remain unaffiliated');
rankingProof(!isset($top[0]['id'], $top[0]['resources_updated_at'], $top[0]['role'], $top[0]['state_json']), 'standings do not serialize private player records');
$database->execute("UPDATE players SET strength = 900 WHERE id = 'rank-02'");
rankingProof(array_values(array_filter($service->snapshot('rank-01')['rows'], fn ($row) => str_starts_with($row['username'], 'Account ')))[0]['username'] === 'Account 2', 'fresh reads reflect committed progression changes');
echo "LEADERBOARDS RESULT: {$passed} passed, 0 failed\n";

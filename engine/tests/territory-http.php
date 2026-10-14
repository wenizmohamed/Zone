<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

// A fresh database, dedicated player and temporary loopback server. Never uses
// the running demo server or its founder account. Only fixtures alter energy,
// family membership and a deadline; every gameplay action uses the real API.
$id = 'map-playtest-player';
$prefix = ZONE_ENGINE_ROOT . '/var/territory-http-' . bin2hex(random_bytes(6));
$dsn = 'sqlite:' . $prefix . '.sqlite';
$engine = zone_engine($dsn);
$db = Database::connect($dsn);
$player = $db->fetchOne("SELECT * FROM players WHERE id = 'founder-player'");
$player['id'] = $id;
$db->insertIgnore('players', array_keys($player), array_values($player));
$db->insertIgnore('faction_members', ['player_id', 'faction_id', 'role', 'joined_at'], [$id, 'vipers', 'member', gmdate('c')]);
$engine->gameplay($id);
// The production one-second cooldown has its own route check below. Zero for
// the score loops keeps the regression deterministic without real-time waits.
$db->execute("UPDATE cooldown_config SET seconds = 0 WHERE action = 'territory'");
$socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
if (!$socket) throw new RuntimeException($error);
$address = stream_socket_get_name($socket, false); fclose($socket);
$base = 'http://' . $address;
$environment = [...getenv(), 'ZONE_DATABASE_URL' => $dsn, 'ZONE_DEMO_PLAYER_ID' => $id, 'ZONE_PLAYER_AUTH' => '', 'VERCEL' => ''];
$process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $prefix . '.server.log', 'a'], 2 => ['file', $prefix . '.server.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true]);
if (!is_resource($process)) throw new RuntimeException('Could not start isolated map API.');
fclose($pipes[0]);
$passed = 0; $trace = [];
function request(string $method, string $path, ?array $body = null): array {
    global $base, $trace;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => "Accept: application/json\r\nContent-Type: application/json\r\nOrigin: {$base}\r\nConnection: close\r\n", 'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 10]]);
    $raw = @file_get_contents($base . $path, false, $context);
    $headers = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $headers[0] ?? '', $match);
    $status = (int) ($match[1] ?? 0);
    $data = $raw === false ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    $trace[] = ['method' => $method, 'path' => $path, 'status' => $status, 'action' => $body['action'] ?? null, 'energy' => $data['player']['energy'] ?? null, 'error' => $data['error'] ?? null];
    return [$status, $data];
}
function proof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo "PASS: {$label}\n"; }
function snapshot(): array { [$status, $map] = request('GET', '/api/v1/city/map'); if ($status !== 200) throw new RuntimeException('Map read failed: ' . json_encode($map)); return $map; }
function block(string $id): array { return array_column(snapshot()['blocks'], null, 'id')[$id]; }
function action(string $id, string $verb, ?int $version = null): array { return request('POST', '/api/v1/territories/' . $id . '/action', ['action' => $verb, 'expectedVersion' => $version ?? block($id)['version']]); }
function actor(string $faction, int $energy = 150): void {
    global $db, $id;
    $db->execute('UPDATE faction_members SET faction_id = :family WHERE player_id = :player', ['family' => $faction, 'player' => $id]);
    $db->execute('UPDATE players SET energy = :energy, resources_updated_at = :now WHERE id = :player', ['energy' => $energy, 'now' => gmdate('c'), 'player' => $id]);
}
function energy(): int { global $db, $id; return (int) $db->fetchOne('SELECT energy FROM players WHERE id = :id', ['id' => $id])['energy']; }
function rivalFixture(string $id): void {
    global $db;
    $db->execute("UPDATE territory_control SET faction_id = 'kings', state = 'owned', control_basis_points = 10000, version = version + 1 WHERE territory_id = :id", ['id' => $id]);
}
try {
    for ($attempt = 0; $attempt < 50; $attempt++) { [$status] = request('GET', '/api/v1/health'); if ($status === 200) break; usleep(100000); }
    proof($status === 200, 'isolated PHP server starts against its private database');
    actor('vipers'); $map = snapshot(); $blocks = $map['blocks'];
    proof(count($blocks) === 120 && count(array_unique(array_column($blocks, 'id'))) === 120, 'HTTP snapshot exposes all 120 distinct selectable blocks');
    $owned = array_values(array_filter($blocks, fn($b) => $b['ownerFactionId'] === 'vipers'))[0];
    proof($owned['action'] === null && $owned['control'] === 100, 'owned full-control details advertise no paid action');
    $claim = array_values(array_filter($blocks, fn($b) => $b['action'] === 'claim'))[0];
    [$status, $receipt] = action($claim['id'], 'claim', $claim['version']);
    proof($status === 200 && $receipt['player']['energy'] === 140 && block($claim['id'])['ownerFactionId'] === 'vipers', 'claim POST spends ten energy and a separate GET reload persists ownership');
    [$status] = action($claim['id'], 'claim', $claim['version']);
    proof($status === 409 && energy() === 140, 'stale claim replay rejects without a second debit');
    $remote = array_values(array_filter(snapshot()['blocks'], fn($b) => $b['ownerFactionId'] === null && $b['action'] === null))[0];
    [$status] = action($remote['id'], 'claim');
    proof($status === 409 && block($remote['id'])['ownerFactionId'] === null && energy() === 140, 'nonadjacent claim is rejected without changing ownership or energy');
    $available = array_values(array_filter(snapshot()['blocks'], fn($b) => $b['action'] === 'claim' && $b['slots'] >= 2));
    usort($available, fn($a, $b) => $a['slots'] <=> $b['slots']); $rival = $available[0]['id']; rivalFixture($rival);
    proof(block($rival)['action'] === 'assault' && block($rival)['actionEnergyCost'] === 25, 'adjacent rival exposes the actual assault action and cost');
    [$status, $receipt] = action($rival, 'assault'); $war = block($rival)['activeWar'];
    proof($status === 200 && $receipt['player']['energy'] === 115 && $war['attackerScore'] === 50000 && $war['targetScore'] === block($rival)['slots'] * 50000, 'assault creates a scored war using the real wall-slot target');
    proof(strtotime($war['endsAt']) - strtotime($war['startedAt']) === 72 * 3600, 'war deadline is the actual seventy-two-hour server window');
    actor('night'); [$status] = action($rival, 'assault');
    proof($status === 409 && energy() === 150 && block($rival)['activeWar']['attackerScore'] === 50000, 'third family cannot join or advance another active war');
    actor('kings'); proof(block($rival)['action'] === 'reinforce', 'defender snapshot offers reinforcement during the same active war');
    [$status, $receipt] = action($rival, 'reinforce');
    proof($status === 200 && $receipt['player']['energy'] === 145 && block($rival)['activeWar']['defenderScore'] === 50000, 'reinforce POST charges five energy and persists defender contribution');
    actor('vipers'); $loops = 0;
    while (block($rival)['activeWar'] !== null && ++$loops < 60) { if (energy() < 25) actor('vipers'); [$status] = action($rival, 'assault'); if ($status !== 200) throw new RuntimeException('Assault loop failed.'); }
    $settled = block($rival);
    proof($settled['ownerFactionId'] === 'vipers' && $settled['activeWar'] === null && $settled['action'] === null, 'real score target settles the attacker win and returns a fully controlled holding');
    $fresh = Database::connect($dsn);
    proof($fresh->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $war['id']])['state'] === 'attacker_won', 'a new database connection sees the persisted attacker result');
    rivalFixture($rival); actor('vipers'); action($rival, 'assault'); $war = block($rival)['activeWar']; actor('kings'); $loops = 0;
    while (block($rival)['activeWar'] !== null && ++$loops < 60) { if (energy() < 5) actor('kings'); [$status] = action($rival, 'reinforce'); if ($status !== 200) throw new RuntimeException('Reinforcement loop failed.'); }
    proof(block($rival)['ownerFactionId'] === 'kings' && $fresh->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $war['id']])['state'] === 'defender_won', 'defender contributions also settle at the unchanged real score target');
    actor('vipers'); action($rival, 'assault'); $war = block($rival)['activeWar'];
    $db->execute('UPDATE territory_wars SET ends_at = :past WHERE id = :id', ['past' => gmdate('c', time() - 1), 'id' => $war['id']]);
    proof(block($rival)['ownerFactionId'] === 'kings' && block($rival)['activeWar'] === null, 'expired persisted war resolves on HTTP read with defender retaining ownership');
    $events = count($fresh->fetchAll("SELECT id FROM event_log WHERE event_name = 'TerritoryWarResolved'")); snapshot(); snapshot();
    proof(count($fresh->fetchAll("SELECT id FROM event_log WHERE event_name = 'TerritoryWarResolved'")) === $events, 'repeat HTTP reads cannot settle the same war twice');
    actor('vipers', 0); $before = block($rival); [$status] = action($rival, 'assault');
    proof($status === 400 && energy() === 0 && block($rival)['version'] === $before['version'], 'insufficient energy rejection keeps version, score and wallet unchanged');
    actor('vipers'); $state = $db->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => $id]); $data = json_decode($state['state_json'], true); $data['hospUntil'] = (time() + 120) * 1000;
    $db->execute('UPDATE player_progression SET state_json = :state WHERE player_id = :id', ['state' => json_encode($data), 'id' => $id]); [$status] = action($rival, 'assault');
    proof($status === 400 && energy() === 150 && block($rival)['version'] === $before['version'], 'hospitalized player cannot bypass the map through a direct action POST');
    $data['hospUntil'] = 0; $db->execute('UPDATE player_progression SET state_json = :state WHERE player_id = :id', ['state' => json_encode($data), 'id' => $id]);
    // A one-second fixture can cross a wall-clock second between HTTP calls.
    // Use a long isolated deadline to test the gate without a timing lottery.
    $db->execute("UPDATE cooldown_config SET seconds = 30 WHERE action = 'territory'"); action($rival, 'assault'); [$status, $cooldownReply] = action($rival, 'assault');
    proof($status === 429 && $cooldownReply['retryAfter'] > 0, 'configured territory cooldown rejects an immediate second command with a retry deadline');
    file_put_contents($prefix . '.json', json_encode(['checks' => $passed, 'database' => $prefix . '.sqlite', 'player' => $id, 'requests' => $trace], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    echo "TERRITORY HTTP RESULT: {$passed} passed, 0 failed\nEvidence: {$prefix}.json\n";
} finally { proc_terminate($process); proc_close($process); }

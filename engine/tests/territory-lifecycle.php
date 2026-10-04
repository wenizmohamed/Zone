<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Territories\TerritoryService;

$db = Database::connect('sqlite:' . ZONE_ENGINE_ROOT . '/var/territory-lifecycle-' . bin2hex(random_bytes(6)) . '.sqlite');
$db->migrateAndSeed();
$service = new TerritoryService($db, new EventBus($db));
$passed = $failed = 0;
function proof(bool $condition, string $name): void {
    global $passed, $failed;
    if ($condition) { $passed++; echo "PASS: $name\n"; }
    else { $failed++; fwrite(STDERR, "FAIL: $name\n"); }
}
function block(string $id): array {
    global $service;
    return array_column($service->snapshot('founder-player')['blocks'], null, 'id')[$id];
}
function act(string $id, string $action): array {
    global $service;
    return $service->act($id, $action, block($id)['version'], 'founder-player');
}
function energy(): int {
    global $db;
    return (int) $db->fetchOne("SELECT energy FROM players WHERE id = 'founder-player'")['energy'];
}
function rejects(callable $call, string $fragment, string $name): void {
    try { $call(); proof(false, $name); }
    catch (Throwable $e) { proof(str_contains($e->getMessage(), $fragment), $name . ' [' . $e->getMessage() . ']'); }
}
function family(string $id): void {
    global $db;
    $db->execute("UPDATE faction_members SET faction_id = :id WHERE player_id = 'founder-player'", ['id' => $id]);
    $db->execute("UPDATE players SET energy = 150 WHERE id = 'founder-player'");
}
try {
    $map = $service->snapshot('founder-player');
    $owned = array_values(array_filter($map['blocks'], fn($b) => $b['ownerFactionId'] === 'vipers'))[0];
    proof($owned['action'] === null && $owned['actionEnergyCost'] === 0, 'fully controlled family land offers no useless paid action');
    $claim = array_values(array_filter($map['blocks'], fn($b) => $b['action'] === 'claim'))[0];
    proof($claim['actionEnergyCost'] === 10, 'claim advertises its authoritative energy cost');
    $before = energy(); act($claim['id'], 'claim');
    proof(energy() === $before - 10 && block($claim['id'])['ownerFactionId'] === 'vipers', 'claim atomically spends energy and persists ownership');
    rejects(fn() => $service->act($claim['id'], 'claim', $claim['version'], 'founder-player'), 'Territory state changed.', 'stale claim rejects replay');
    proof(energy() === $before - 10, 'rejected replay cannot spend energy');

    // Deterministic adjacent rival, with a short score target for boundary tests.
    $rival = array_values(array_filter($service->snapshot('founder-player')['blocks'], fn($b) => $b['action'] === 'claim'))[0]['id'];
    $service->setOwnership($rival, 'kings', 'test');
    proof(block($rival)['actionEnergyCost'] === 25, 'assault advertises its cost before the player acts');
    act($rival, 'assault'); $war = block($rival)['activeWar'];
    proof($war['attackerScore'] === 50000 && $war['defenderScore'] === 0, 'first assault creates a persisted scored war');
    proof(abs(strtotime($war['endsAt']) - strtotime($war['startedAt']) - 259200) <= 1, 'war deadline is seventy-two real server hours');
    proof(block($rival)['state'] === 'contested' && block($rival)['action'] === 'assault', 'attacking family can contribute again to its active war');
    $db->execute('UPDATE territory_wars SET target_score = 100000 WHERE id = :id', ['id' => $war['id']]);
    $priorVersion = block($rival)['version']; act($rival, 'assault');
    $taken = block($rival);
    proof($taken['ownerFactionId'] === 'vipers' && $taken['state'] === 'owned' && $taken['activeWar'] === null, 'score threshold resolves capture and removes active war');
    proof($taken['version'] > $priorVersion && $db->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $war['id']])['state'] === 'attacker_won', 'capture version and war result persist');
    $resolvedCount = (int) $db->fetchOne("SELECT COUNT(*) AS n FROM event_log WHERE event_name = 'TerritoryWarResolved'")['n'];
    $service->snapshot('founder-player'); $service->snapshot('founder-player');
    proof((int) $db->fetchOne("SELECT COUNT(*) AS n FROM event_log WHERE event_name = 'TerritoryWarResolved'")['n'] === $resolvedCount, 'repeated reads cannot settle or reward a war twice');

    $service->setOwnership($rival, 'kings', 'test'); family('vipers'); act($rival, 'assault');
    $war = block($rival)['activeWar'];
    $db->execute('UPDATE territory_wars SET target_score = 100000 WHERE id = :id', ['id' => $war['id']]);
    family('night');
    proof(block($rival)['action'] === null, 'third faction cannot join or hijack an active war');
    rejects(fn() => act($rival, 'assault'), 'already active', 'third-faction attack is rejected on the server');
    family('kings');
    proof(block($rival)['action'] === 'reinforce' && block($rival)['actionEnergyCost'] === 5, 'defending family sees its own reinforcement action and cost');
    act($rival, 'reinforce');
    proof(block($rival)['activeWar']['defenderScore'] === 50000 && block($rival)['state'] === 'contested' && energy() === 145, 'reinforcement advances defense without prematurely clearing war');
    act($rival, 'reinforce');
    proof(block($rival)['ownerFactionId'] === 'kings' && block($rival)['activeWar'] === null, 'defender reaching target retains its land');
    proof($db->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $war['id']])['state'] === 'defender_won', 'defensive victory has a durable resolved state');

    family('vipers'); act($rival, 'assault'); $war = block($rival)['activeWar']; $stale = block($rival)['version'];
    $db->execute('UPDATE territory_wars SET ends_at = :ended WHERE id = :id', ['ended' => gmdate('c', time() - 1), 'id' => $war['id']]);
    $settled = (new TerritoryService($db, new EventBus($db)))->snapshot('founder-player');
    proof(array_column($settled['blocks'], null, 'id')[$rival]['ownerFactionId'] === 'kings' && block($rival)['activeWar'] === null, 'restart after deadline settles to defender ownership');
    rejects(fn() => $service->act($rival, 'assault', $stale, 'founder-player'), 'Territory state changed.', 'pre-expiry request cannot operate on the settled version');
    proof($db->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $war['id']])['state'] === 'defender_won', 'deadline resolution is persisted');

    $expiredWar = $db->fetchOne('SELECT * FROM territory_wars WHERE id = :id', ['id' => $war['id']]);
    act($rival, 'assault'); $newWar = block($rival)['activeWar']; $newVersion = block($rival)['version'];
    $resolver = new ReflectionMethod(TerritoryService::class, 'resolveWar');
    $db->transaction(fn() => $resolver->invoke($service, $expiredWar, 'kings', 'expired'));
    proof(block($rival)['activeWar']['id'] === $newWar['id'] && block($rival)['version'] === $newVersion, 'stale expiry snapshot cannot touch a newer active war on the same block');
    // PostgreSQL returns TIMESTAMPTZ with a space separator and its session
    // offset, unlike gmdate('c'). A stale expiry candidate must recheck time.
    $futurePgTimestamp = gmdate('Y-m-d') . ' 23:59:59-12';
    $db->execute('UPDATE territory_wars SET ends_at = :ends WHERE id = :id', ['ends' => $futurePgTimestamp, 'id' => $newWar['id']]);
    $candidate = $db->fetchOne('SELECT * FROM territory_wars WHERE id = :id', ['id' => $newWar['id']]);
    $db->transaction(fn() => $resolver->invoke($service, $candidate, 'kings', 'expired'));
    proof($db->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $newWar['id']])['state'] === 'active', 'PostgreSQL timestamp format cannot prematurely resolve a future war');
    proof((int) $db->fetchOne('SELECT version FROM territory_control WHERE territory_id = :id', ['id' => $rival])['version'] === $newVersion, 'future PostgreSQL timestamp preserves territory version');
    $db->execute('UPDATE territory_wars SET ends_at = :ends WHERE id = :id', ['ends' => $newWar['endsAt'], 'id' => $newWar['id']]);
    $db->execute("CREATE TRIGGER cross_war_deadline AFTER UPDATE ON territory_control WHEN NEW.version > OLD.version AND NEW.territory_id = '" . $rival . "' BEGIN UPDATE territory_wars SET ends_at = '2000-01-01T00:00:00+00:00' WHERE territory_id = NEW.territory_id AND state = 'active'; END");
    $beforeDeadlineEnergy = energy();
    rejects(fn() => act($rival, 'assault'), 'Territory state changed.', 'contribution crossing the deadline after eligibility is rejected');
    $db->execute('DROP TRIGGER cross_war_deadline');
    proof(energy() === $beforeDeadlineEnergy && block($rival)['activeWar']['attackerScore'] === 50000, 'deadline race cannot charge energy or add late score');
    $service->setOwnership($rival, 'kings', 'test');

    $db->execute("UPDATE players SET energy = 0 WHERE id = 'founder-player'");
    $beforeBlock = block($rival);
    rejects(fn() => act($rival, 'assault'), 'Not enough energy', 'energy gate rejects unpayable assault');
    proof(block($rival)['version'] === $beforeBlock['version'] && block($rival)['activeWar'] === null, 'failed energy gate creates no war or territory mutation');
    family('vipers');
    $db->execute("CREATE TRIGGER fail_territory_event BEFORE INSERT ON event_log WHEN NEW.event_name = 'TerritoryControlChanged' BEGIN SELECT RAISE(ABORT, 'test event failure'); END");
    $beforeEnergy = energy();
    rejects(fn() => act($rival, 'assault'), 'test event failure', 'event persistence failure propagates');
    $db->execute('DROP TRIGGER fail_territory_event');
    proof(energy() === $beforeEnergy && block($rival)['version'] === $beforeBlock['version'] && block($rival)['activeWar'] === null, 'event failure rolls back energy, war and territory together');
    act($rival, 'assault'); $war = block($rival)['activeWar'];
    $service->setOwnership($rival, 'night', 'test');
    proof(block($rival)['ownerFactionId'] === 'night' && block($rival)['activeWar'] === null && $db->fetchOne('SELECT state FROM territory_wars WHERE id = :id', ['id' => $war['id']])['state'] === 'cancelled', 'admin ownership override cancels the old active war');
} catch (Throwable $e) { proof(false, $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine()); }
echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);

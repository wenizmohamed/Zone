<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\FamilyActivityService;
use Zone\Engine\Core\Game\FamilyCompetitionSubscriber;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Persistence\Database;

$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/beta-multiplayer-integration-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback database required.');
}
$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db); $count = 0;
function integrationProof(bool $ok, string $label): void {
    global $count;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    ++$count; echo 'PASS: ' . $label . PHP_EOL;
}
function integrationReject(callable $action, string $reason = ''): bool {
    try { $action(); } catch (RuntimeException|InvalidArgumentException $error) {
        if ($error instanceof PDOException) throw $error;
        return $reason === '' || str_contains($error->getMessage(), $reason);
    }
    return false;
}
function integrationPlayer(): string {
    global $engine, $db;
    $id = $engine->browserSessions()->create('integration-' . bin2hex(random_bytes(6)))['playerId'];
    // Freeze only resource regeneration in this disposable fixture. Combat
    // still uses the actual GameEngine, real stats and its real random source.
    $db->execute('UPDATE players SET resources_updated_at = :at WHERE id = :id', ['at' => gmdate('c', time() + 3600), 'id' => $id]);
    return $id;
}
function integrationFamily(): string {
    global $db;
    $id = 'integration-' . bin2hex(random_bytes(6));
    $db->execute('INSERT INTO factions (id, name_en, name_ar, color, enabled) VALUES (:id, :en, :ar, :color, 1)', ['id' => $id, 'en' => 'Real integration family', 'ar' => 'عائلة اختبار حقيقية', 'color' => '#667788']);
    return $id;
}
function integrationScore(string $actor, string $family): int {
    global $engine;
    foreach ($engine->familyActivities($actor)['competition']['ranks'] as $row) if ($row['factionId'] === $family) return $row['score'];
    throw new RuntimeException('Actual family absent from competition.');
}
function integrationOperation(string $actor, string $id): array {
    global $engine;
    foreach ($engine->familyActivities($actor)['operations'] as $row) if ($row['id'] === $id) return $row;
    throw new RuntimeException('Actual operation absent from snapshot.');
}
function integrationOperationAct(string $action, string $actor, string $id): array {
    global $engine;
    return $engine->familyActivityAction($action, $id, integrationOperation($actor, $id)['version'], $actor);
}
function integrationReplay(string $name, string $id): void {
    global $db, $events;
    $row = $db->fetchOne('SELECT * FROM event_log WHERE id = :id AND event_name = :name', ['id' => $id, 'name' => $name]);
    if ($row === null) throw new RuntimeException('Missing actual settled event.');
    // Replay the real persisted delivery into its subscriber, not a fabricated
    // initial contribution and not another event_log insert using a duplicate PK.
    (new FamilyCompetitionSubscriber($db, $events, $name))->handle(new DomainEvent($name, json_decode($row['payload_json'], true, 512, JSON_THROW_ON_ERROR), $row['id'], $row['occurred_at']));
}

$leader = integrationPlayer(); $member = integrationPlayer(); $defender = integrationPlayer();
$family = integrationFamily(); $rival = integrationFamily();
$engine->joinFaction($family, $leader); $engine->joinFaction($family, $member); $engine->joinFaction($rival, $defender);
integrationProof(integrationScore($leader, $family) === 0 && integrationScore($defender, $rival) === 0, 'actual GameEngine membership appears in weekly competition with zero initial score');
integrationProof(integrationReject(fn () => $engine->familyActivityAction('create', 'dock-intercept', 1, $member), 'leader'), 'GameEngine rejects operation creation by a real nonleader');

$progression = new ProgressionService($db, $events);
foreach ([$leader, $defender] as $id) $progression->grantItem($id, 'smallkit', 1);
$db->execute('UPDATE players SET strength = 1000000, speed = 1000000000, life = 100 WHERE id = :id', ['id' => $leader]);
$db->execute('UPDATE players SET life = 1, dexterity = 10 WHERE id = :id', ['id' => $defender]);
$before = $engine->gameplay($leader); $defenderBefore = $engine->gameplay($defender);
$fight = $engine->playerCombatAction('start', $defender, '', $engine->playerCombat($leader)['version'], $leader);
integrationProof($fight['player']['energy'] === 75 && $engine->playerCombat($defender)['incoming']['attackerId'] === $leader, 'GameEngine starts genuine two-account combat and exposes its real defender reservation');
integrationProof(integrationReject(fn () => $engine->gameplayAction('item.use', 'smallkit', $before['state']['version'], $leader), 'fight'), 'GameEngine rejects healing item consumption by the reserved attacker');
integrationProof(integrationReject(fn () => $progression->act('item.use', 'smallkit', $before['state']['version'], $leader), 'fight'), 'ProgressionService internal reservation guard also protects item.use without the GameEngine wrapper');
integrationProof(integrationReject(fn () => $engine->hospitalHeal($leader), 'fight') && $engine->player($leader)['life'] === 100, 'GameEngine hospital cannot change reserved attacker life or spend its cash');
$won = $engine->playerCombatAction('strike', '', '', $fight['version'], $leader);
integrationProof($won['encounter']['phase'] === 'won' && $engine->player($defender)['life'] === 0, 'one real strike settles damage against the real defender using server stats');
integrationProof(integrationReject(fn () => $engine->gameplayAction('item.use', 'smallkit', $defenderBefore['state']['version'], $defender), 'fight') && integrationReject(fn () => $engine->hospitalHeal($defender), 'fight'), 'the defeated defender cannot heal away damage while the winner still holds the finish reservation');
$unchanged = $engine->gameplay($defender);
integrationProof($unchanged['state']['version'] === $defenderBefore['state']['version'] && $unchanged['state']['inv']['smallkit'] === $defenderBefore['state']['inv']['smallkit'] && $engine->player($defender)['cash'] === $defenderBefore['player']['cash'] && $engine->player($defender)['life'] === 0, 'rejected defender healing preserves progression version, item, cash and actual zero life');
integrationProof(integrationScore($leader, $family) === 0, 'combat start and damage alone cannot score a hospital finish');
$finished = $engine->playerCombatAction('finish', '', 'hosp', $won['version'], $leader);
integrationProof($finished['result']['outcome'] === 'won' && $finished['result']['defenderId'] === $defender && integrationScore($leader, $family) === 10, 'actual GameEngine hospital finish invokes its subscription and scores the real family exactly ten points');
integrationProof($engine->gameplay($defender)['state']['hospUntil'] >= (time() + 590) * 1000 && $engine->playerCombat($defender)['incoming'] === null, 'settled finish applies real ten-minute hospitalization and releases defender reservation');
$event = $db->fetchOne('SELECT id FROM event_log WHERE event_name = :name AND CAST(payload_json AS TEXT) LIKE :actor ORDER BY occurred_at DESC LIMIT 1', ['name' => 'PlayerCombatResolved', 'actor' => '%' . $leader . '%']);
integrationReplay('PlayerCombatResolved', $event['id']);
integrationProof(integrationScore($leader, $family) === 10 && integrationReject(fn () => $engine->playerCombatAction('finish', '', 'hosp', $won['version'], $leader)), 'replayed actual hospital event and stale GameEngine finish cannot duplicate seasonal score');
$used = $engine->gameplayAction('item.use', 'smallkit', $engine->gameplay($leader)['state']['version'], $leader);
integrationProof($used['state']['inv']['smallkit'] === $before['state']['inv']['smallkit'] - 1 && $engine->player($leader)['life'] === 250, 'normal healing item action succeeds after real combat reservation release');
$healed = $engine->hospitalHeal($defender);
integrationProof($healed['player']['life'] === 250 && $engine->gameplay($defender)['state']['hospUntil'] === 0, 'normal paid hospital recovery succeeds after combat finish');

$id = $engine->familyActivityAction('create', 'dock-intercept', 1, $leader)['result']['operationId'];
integrationOperationAct('join', $leader, $id); integrationOperationAct('join', $member, $id);
$leaderCash = $engine->player($leader)['cash']; $memberCash = $engine->player($member)['cash'];
integrationOperationAct('start', $leader, $id); $running = integrationOperation($leader, $id);
integrationProof($running['state'] === 'running' && $running['readyAt'] >= (time() + 298) * 1000 && integrationReject(fn () => integrationOperationAct('resolve', $member, $id), 'not ready'), 'GameEngine operation uses real roster energy and server five-minute readiness gate');
// Explicitly advance only the stored deadline in the disposable fixture. This
// tests the post-deadline branch without pretending five real minutes elapsed.
$db->execute('UPDATE family_operations SET ready_at = :ready WHERE id = :id', ['ready' => (time() - 1) * 1000, 'id' => $id]);
$resolved = integrationOperationAct('resolve', $member, $id);
integrationProof($resolved['result']['cashPerMember'] === 600 && $engine->player($leader)['cash'] === $leaderCash + 600 && $engine->player($member)['cash'] === $memberCash + 600, 'GameEngine resolves cooperative payout to both registered real wallets');
integrationProof(integrationScore($leader, $family) === 15 && integrationOperation($leader, $id)['state'] === 'completed', 'actual resolved operation contributes five points to the existing real family');
(new FamilyActivityService($db, $events))->recordCompetition($leader, 'operation', $id);
integrationProof(integrationScore($leader, $family) === 15 && integrationReject(fn () => $engine->familyActivityAction('resolve', $id, $running['version'], $leader)), 'duplicate trusted operation contribution and stale GameEngine resolve do not pay or score twice');
integrationProof((int) $db->fetchOne('SELECT COUNT(*) AS n FROM family_competition_events WHERE faction_id = :id', ['id' => $family])['n'] === 2, 'dedup ledger contains exactly one real hospital event and one real operation event');

// Pick an adjacent pair from the original 120-block topology, excluding live
// wars from other runs in the reusable disposable PostgreSQL database.
$blocks = array_column($engine->territoryMap($leader)['blocks'], null, 'id'); $pair = null;
foreach ($blocks as $block) {
    if ($block['activeWar'] !== null) continue;
    foreach ($block['neighbors'] as $neighbor) if (isset($blocks[$neighbor]) && $blocks[$neighbor]['activeWar'] === null) { $pair = [$block, $blocks[$neighbor]]; break 2; }
}
if ($pair === null) throw new RuntimeException('No real adjacent test blocks available.');
[$anchor, $target] = $pair;
try {
    $engine->setTerritoryOwnership($anchor['id'], $family, 'disposable-integration-fixture');
    $engine->setTerritoryOwnership($target['id'], $rival, 'disposable-integration-fixture');
    integrationProof(integrationScore($leader, $family) === 15, 'administrative fixture ownership does not count as a player war contribution');
    $live = array_column($engine->territoryMap($leader)['blocks'], null, 'id')[$target['id']];
    integrationProof($live['action'] === 'assault', 'actual map topology grants assault only through the controlled adjacent block');
    $assault = $engine->actTerritory($target['id'], 'assault', $live['version'], $leader);
    integrationProof(integrationScore($leader, $family) === 16 && $assault['player']['energy'] === 40, 'actual GameEngine territory assault contributes one seasonal point and spends real energy');
    integrationReplay('TerritoryControlChanged', $assault['eventId']);
    integrationProof(integrationScore($leader, $family) === 16 && integrationReject(fn () => $engine->actTerritory($target['id'], 'assault', $live['version'], $leader)), 'actual territory event redelivery and stale assault cannot score again');
} finally {
    $engine->setTerritoryOwnership($anchor['id'], $anchor['ownerFactionId'], 'disposable-integration-cleanup');
    $engine->setTerritoryOwnership($target['id'], $target['ownerFactionId'], 'disposable-integration-cleanup');
}
integrationProof(integrationScore($defender, $rival) === 0, 'defeated real rival family receives no invented points');
echo 'BETA MULTIPLAYER INTEGRATION RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;

<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\FamilyActivityService;
use Zone\Engine\Core\Game\FamilyProgressionService;

$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/family-activities-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback database required.');
}
$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db); $service = new FamilyActivityService($db, $events);
if (($argv[1] ?? '') === '--worker') {
    echo "READY\n"; fflush(STDOUT); fgets(STDIN);
    echo "ATTEMPTING\n"; fflush(STDOUT);
    try {
        $action = (string) getenv('ZONE_ACTIVITY_ACTION');
        if ($action === 'score') $service->recordCompetition((string) getenv('ZONE_ACTIVITY_PLAYER'), 'player-hospitalize', (string) getenv('ZONE_ACTIVITY_OPERATION'));
        else $service->act($action, (string) getenv('ZONE_ACTIVITY_OPERATION'), (int) getenv('ZONE_ACTIVITY_VERSION'), (string) getenv('ZONE_ACTIVITY_PLAYER'));
        echo "settled\n"; exit(0);
    } catch (RuntimeException $error) {
        if (str_contains($error->getMessage(), 'changed') || str_contains($error->getMessage(), 'already ended') || str_contains($error->getMessage(), 'full')) { echo "stale\n"; exit(10); }
        throw $error;
    }
}
$count = 0;
function activityProof(bool $ok, string $label): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
function activityReject(callable $fn): bool { try { $fn(); } catch (RuntimeException|InvalidArgumentException $error) { if ($error instanceof PDOException) throw $error; return true; } return false; }
function activityPlayer(string $prefix): string {
    global $engine, $db;
    $id = $engine->browserSessions()->create($prefix . '-' . bin2hex(random_bytes(6)))['playerId'];
    $db->execute('UPDATE players SET energy = 100, resources_updated_at = :at WHERE id = :id', ['at' => gmdate('c'), 'id' => $id]);
    return $id;
}
function activityFamily(string $name): string {
    global $db;
    $id = 'activity-' . bin2hex(random_bytes(6));
    $db->execute('INSERT INTO factions (id, name_en, name_ar, color, enabled) VALUES (:id, :name, :ar, :color, 1)', ['id' => $id, 'name' => $name, 'ar' => 'عائلة اختبار حقيقية', 'color' => '#667788']);
    return $id;
}
function activityOp(string $id, string $player): array { global $service; foreach ($service->snapshot($player)['operations'] as $op) if ($op['id'] === $id) return $op; throw new RuntimeException('Missing operation.'); }
function activityAct(string $action, string $id, string $player): array { global $service; return $service->act($action, $id, activityOp($id, $player)['version'], $player); }
function activityValue(string $player, string $field): int { global $db; return (int) $db->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $player])[$field]; }
function activityResetCooldown(string $family): void { global $db; $db->execute('UPDATE family_operations SET completed_at = :at WHERE faction_id = :family AND completed_at IS NOT NULL', ['at' => gmdate('c', time() - 601), 'family' => $family]); }
function activityRace(string $action, string $id, int $version, array $players): array {
    global $url, $db;
    $workers = [];
    foreach ($players as $player) {
        $worker = proc_open([PHP_BINARY, '-d', 'extension=pdo_pgsql', __FILE__, '--worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DEPTH_TEST_URL' => $url, 'ZONE_ACTIVITY_ACTION' => $action, 'ZONE_ACTIVITY_OPERATION' => $id, 'ZONE_ACTIVITY_VERSION' => (string) $version, 'ZONE_ACTIVITY_PLAYER' => $player], ['bypass_shell' => true]);
        if (!is_resource($worker)) throw new RuntimeException('Activity worker did not start.');
        stream_set_timeout($pipes[1], 15);
        if (trim((string) fgets($pipes[1])) !== 'READY') throw new RuntimeException('Activity worker not ready: ' . stream_get_contents($pipes[2]));
        $workers[] = [$worker, $pipes];
    }
    $locked = $players;
    if ($action !== 'score') {
        $locked = [...$locked, ...array_column($db->fetchAll('SELECT player_id FROM family_operation_members WHERE operation_id = :id', ['id' => $id]), 'player_id')];
        $operation = $db->fetchOne('SELECT created_by FROM family_operations WHERE id = :id', ['id' => $id]);
        if ($operation !== null) $locked[] = $operation['created_by'];
    }
    $db->playersTransaction($locked, function () use ($workers): void {
        foreach ($workers as [$worker, $pipes]) { fwrite($pipes[0], "GO\n"); fflush($pipes[0]); }
        foreach ($workers as [$worker, $pipes]) if (trim((string) fgets($pipes[1])) !== 'ATTEMPTING') throw new RuntimeException('Activity worker did not attempt settlement.');
        usleep(150000);
        foreach ($workers as [$worker]) if (!proc_get_status($worker)['running']) throw new RuntimeException('Activity worker bypassed held participant locks.');
    });
    $settled = 0; $stale = 0;
    foreach ($workers as [$worker, $pipes]) {
        fclose($pipes[0]);
        $out = trim(stream_get_contents($pipes[1])); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $exit = proc_close($worker);
        if ($exit === 0 && $out === 'settled') $settled++;
        elseif ($exit === 10 && $out === 'stale') $stale++;
        else throw new RuntimeException('Activity worker failed: ' . $out . $error);
    }
    return [$settled, $stale];
}

$leader = activityPlayer('activity-leader'); $a = activityPlayer('activity-a'); $b = activityPlayer('activity-b'); $outsider = activityPlayer('activity-outsider');
// A nonparticipant creator sorts before the entire paid roster. This exposes
// any creator lock acquired late by the participant resolving the same job.
$ordered = [$leader, $a, $b]; sort($ordered, SORT_STRING); [$leader, $a, $b] = $ordered;
$family = activityFamily('Operation participants'); $otherFamily = activityFamily('Other real family');
$engine->joinFaction($family, $leader); $engine->joinFaction($family, $a); $engine->joinFaction($family, $b); $engine->joinFaction($otherFamily, $outsider);
$anon = activityPlayer('activity-nonmember');
activityProof(!$service->snapshot($anon)['permissions']['create'] && $service->snapshot($anon)['competition']['ownFactionId'] === null, 'nonmember snapshot has no invented competition team or create permission');
activityProof($service->snapshot($anon)['createReason'] === 'family_required' && $service->snapshot($a)['createReason'] === 'leader_required', 'creation permission reports actual membership and leader restriction');
activityProof(activityReject(fn () => $service->snapshot('missing-account')) && activityReject(fn () => $service->act('create', 'dock-intercept', 1, 'missing-account')), 'unknown account cannot read or mutate authenticated activities');
activityProof(activityReject(fn () => $service->act('create', 'dock-intercept', 1, $a)), 'ordinary member cannot create an operation');
activityProof(activityReject(fn () => $service->act('create', 'invented-operation', 1, $leader)), 'client cannot invent an operation definition or reward');
$created = $service->act('create', 'dock-intercept', 1, $leader); $id = $created['result']['operationId'];
activityProof(activityValue($leader, 'energy') === 100 && count(activityOp($id, $leader)['participants']) === 0, 'creation forms an empty real roster without charging leader');
activityProof(activityReject(fn () => $service->act('create', 'warehouse-heist', 1, $leader)) && $service->snapshot($leader)['createReason'] === 'operation_active', 'one active operation per family is enforced and reports the actual leader restriction');
activityProof(activityReject(fn () => $service->act('join', $id, 1, $outsider)), 'member of another actual family cannot join the operation');
$db->execute('UPDATE players SET energy = 0 WHERE id = :id', ['id' => $a]);
activityProof(activityReject(fn () => activityAct('join', $id, $a)) && count(activityOp($id, $leader)['participants']) === 0, 'insufficient energy cannot register an unpaid participant');
$db->execute('UPDATE players SET energy = 100 WHERE id = :id', ['id' => $a]);
(new \Zone\Engine\Core\Game\ProgressionService($db, $events))->applyPenalty($a, 'hosp', 10);
activityProof(activityReject(fn () => activityAct('join', $id, $a)) && activityValue($a, 'energy') === 100, 'hospitalized player cannot commit operation energy');
activityProof(!activityOp($id, $a)['permissions']['join'] && activityOp($id, $a)['joinReason'] !== '', 'snapshot disables hospitalized participation with a real reason');
$penalty = json_decode($db->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => $a])['state_json'], true); $penalty['hospUntil'] = 0;
$db->execute('UPDATE player_progression SET state_json = :state WHERE player_id = :id', ['state' => json_encode($penalty, JSON_THROW_ON_ERROR), 'id' => $a]);
(new \Zone\Engine\Core\Game\TravelService($db, $events))->depart($a, 'Zone City', 'Cairo', 300);
activityProof(activityReject(fn () => activityAct('join', $id, $a)) && activityValue($a, 'energy') === 100, 'traveling player cannot bypass participation availability');
$db->execute("UPDATE player_travel SET status = 'arrived' WHERE player_id = :id", ['id' => $a]);
$db->execute('INSERT INTO player_combat_locks (player_id, encounter_id, attacker_id, defender_id, expires_at) VALUES (:id, :encounter, :attacker, :defender, :expires)', ['id' => $a, 'encounter' => 'activity-fight', 'attacker' => $a, 'defender' => $outsider, 'expires' => time() + 300]);
activityProof(activityReject(fn () => activityAct('join', $id, $a)) && !activityOp($id, $a)['permissions']['join'] && activityValue($a, 'energy') === 100, 'reserved real player fight blocks both join mutation and snapshot permission');
$db->execute('UPDATE player_combat_locks SET expires_at = :expires WHERE player_id = :id', ['expires' => time() - 1, 'id' => $a]);
activityProof(activityReject(fn () => activityAct('join', $id, $a)), 'expired unresolved player fight must be explicitly cleared before joining');
$db->execute('DELETE FROM player_combat_locks WHERE player_id = :id', ['id' => $a]);
$joinedReceipt = activityAct('join', $id, $a);
activityProof($joinedReceipt['result']['energyDelta'] === -10, 'join receipt reports the exact authoritative committed energy');
activityProof(activityValue($a, 'energy') === 90, 'actual joining member commits exactly ten energy');
activityProof(activityReject(fn () => $service->act('join', $id, 1, $b)) && activityValue($b, 'energy') === 100, 'stale join version cannot spend another player energy');
activityProof(activityReject(fn () => activityAct('join', $id, $a)) && activityValue($a, 'energy') === 90, 'repeated participant join cannot charge energy twice');
$db->execute('UPDATE players SET energy = 100 WHERE id = :id', ['id' => $a]);
$leaveReceipt = activityAct('leave', $id, $a);
activityProof($leaveReceipt['result']['energyDelta'] === 10, 'leave receipt reports the stored refund even after over-cap regeneration');
activityProof(activityValue($a, 'energy') === 110 && count(activityOp($id, $leader)['participants']) === 0, 'forming leave refunds exact committed amount even after regeneration reaches the cap');
activityProof(activityReject(fn () => activityAct('leave', $id, $a)) && activityValue($a, 'energy') === 110, 'second leave cannot refund twice');
$db->execute('UPDATE players SET energy = 100 WHERE id = :id', ['id' => $a]);
activityAct('join', $id, $a); activityAct('join', $id, $b);
activityProof(activityReject(fn () => activityAct('start', $id, $a)), 'member cannot bypass leader start permission');
activityProof(activityReject(fn () => activityAct('join', $id, $leader)), 'full required roster cannot accept an extra participant');
$db->execute('INSERT INTO player_combat_locks (player_id, encounter_id, attacker_id, defender_id, expires_at) VALUES (:id, :encounter, :attacker, :defender, :expires)', ['id' => $b, 'encounter' => 'activity-start-fight', 'attacker' => $b, 'defender' => $outsider, 'expires' => time() + 300]);
activityProof(activityReject(fn () => activityAct('start', $id, $leader)) && !activityOp($id, $leader)['permissions']['start'] && activityOp($id, $leader)['state'] === 'forming', 'leader cannot start with a participant currently reserved in real combat');
$db->execute('DELETE FROM player_combat_locks WHERE player_id = :id', ['id' => $b]);
$start = activityAct('start', $id, $leader); $started = activityOp($id, $leader);
activityProof($started['state'] === 'running' && $started['readyAt'] >= (time() + 298) * 1000 && $started['readyAt'] <= (time() + 301) * 1000, 'server start sets the real five-minute commitment deadline');
activityProof(activityReject(fn () => activityAct('resolve', $id, $a)), 'operation cannot pay before server readiness deadline');
activityProof(activityReject(fn () => activityAct('leave', $id, $a)) && activityReject(fn () => activityAct('cancel', $id, $leader)), 'running commitment cannot be cancelled or refunded');
$cashA = activityValue($a, 'cash'); $cashB = activityValue($b, 'cash'); $cashLeader = activityValue($leader, 'cash');
$db->execute('UPDATE family_operations SET ready_at = :ready WHERE id = :id', ['ready' => (time() - 1) * 1000, 'id' => $id]);
$db->execute('UPDATE faction_members SET faction_id = :family WHERE player_id = :id', ['family' => $otherFamily, 'id' => $b]);
activityProof(activityReject(fn () => activityAct('resolve', $id, $leader)) && activityValue($a, 'cash') === $cashA && activityValue($b, 'cash') === $cashB, 'changed real membership rejects resolution and rolls back every payout');
$db->execute('UPDATE faction_members SET faction_id = :family WHERE player_id = :id', ['family' => $family, 'id' => $b]);
[$settled, $stale] = activityRace('resolve', $id, $started['version'], [$leader, $a]);
activityProof($settled === 1 && $stale === 1, 'two distinct real accounts racing resolution settle exactly once');
activityProof(activityValue($a, 'cash') === $cashA + 600 && activityValue($b, 'cash') === $cashB + 600 && activityValue($leader, 'cash') === $cashLeader, 'payout is split only between registered participants, never the nonparticipant creator');
$shared = (new FamilyProgressionService($db, $events))->snapshot($leader);
activityProof($shared['respect'] === 20 && count($shared['ledger']) === 1, 'operation credits shared family respect and ledger exactly once');
activityProof((int) $db->fetchOne("SELECT COUNT(*) AS total FROM economy_ledger WHERE reason = 'family.operation.reward' AND correlation_id = (SELECT correlation_id FROM family_respect_ledger WHERE faction_id = :family LIMIT 1)", ['family' => $family])['total'] === 2, 'each real participant receives one audited cash settlement');
activityProof(activityOp($id, $leader)['state'] === 'completed' && activityReject(fn () => activityAct('resolve', $id, $leader)), 'completed operation cannot resolve again at its new version');
activityProof(activityReject(fn () => $service->act('create', 'dock-intercept', 1, $leader)) && !$service->snapshot($leader)['permissions']['create'] && $service->snapshot($leader)['createReason'] === 'cooldown', 'real completed timestamp enforces and reports five-minute family cooldown');

activityResetCooldown($family);
$created = $service->act('create', 'warehouse-heist', 1, $leader); $warehouse = $created['result']['operationId'];
foreach ([$leader, $a, $b] as $player) activityAct('join', $warehouse, $player);
activityProof(activityOp($warehouse, $leader)['requiredMembers'] === 3 && activityValue($leader, 'energy') === 85 && activityValue($a, 'energy') === 75 && activityValue($b, 'energy') === 75, 'warehouse requires three real members with fifteen committed energy each');
activityProof(activityReject(fn () => activityAct('cancel', $warehouse, $a)), 'member cannot cancel another participant commitments');
$cancelReceipt = activityAct('cancel', $warehouse, $leader);
$refunds = array_column($cancelReceipt['result']['energyRefunds'], 'energy', 'playerId');
activityProof(count($refunds) === 3 && $refunds[$leader] === 15 && $refunds[$a] === 15 && $refunds[$b] === 15, 'cancel receipt identifies each real participant and its exact stored refund');
activityProof(activityValue($leader, 'energy') === 100 && activityValue($a, 'energy') === 90 && activityValue($b, 'energy') === 90 && activityOp($warehouse, $leader)['state'] === 'cancelled', 'leader cancellation refunds every stored energy cost atomically');
activityProof(activityReject(fn () => activityAct('cancel', $warehouse, $leader)) && activityValue($a, 'energy') === 90, 'cancel replay cannot refund participants twice');
activityResetCooldown($family);
$id2 = $service->act('create', 'dock-intercept', 1, $leader)['result']['operationId']; activityAct('join', $id2, $a);
[$settled, $stale] = activityRace('join', $id2, activityOp($id2, $leader)['version'], [$leader, $b]);
activityProof($settled === 1 && $stale === 1 && count(activityOp($id2, $leader)['participants']) === 2, 'simultaneous distinct-account joins fill the last real roster slot once');
activityProof(activityValue($leader, 'energy') + activityValue($b, 'energy') === 180, 'losing join race spends no energy');
activityAct('cancel', $id2, $leader);

$season = $service->snapshot($leader)['competition'];
$rank = array_values(array_filter($season['ranks'], fn ($r) => $r['factionId'] === $family))[0];
activityProof($season['status'] === 'active' && $rank['score'] === 5 && $rank['memberCount'] === 3, 'completed operation contributes five points to its actual family and live roster');
activityProof($season['endsAt'] - $season['startsAt'] === 7 * 86400 * 1000 && gmdate('N H:i:s', intdiv($season['startsAt'], 1000)) === '1 00:00:00', 'weekly season uses actual UTC Monday boundaries');
$correlation = 'real-hospital-' . bin2hex(random_bytes(8));
[$settled, $stale] = activityRace('score', $correlation, 1, [$a, $b]);
$afterScore = $service->snapshot($a)['competition']; $rank = array_values(array_filter($afterScore['ranks'], fn ($r) => $r['factionId'] === $family))[0];
activityProof($settled === 2 && $stale === 0 && $rank['score'] === 15, 'duplicate authoritative scoring event across two accounts awards ten points only once');
$service->recordCompetition($a, 'territory-assault', 'territory-' . bin2hex(random_bytes(8)));
activityProof(array_values(array_filter($service->snapshot($a)['competition']['ranks'], fn ($r) => $r['factionId'] === $family))[0]['score'] === 16, 'real territory contribution awards one point under current season');
activityProof(activityReject(fn () => $service->recordCompetition($a, 'invented-score', 'bad')), 'client cannot supply an arbitrary competition score or scoring kind');
$zero = array_values(array_filter($service->snapshot($outsider)['competition']['ranks'], fn ($r) => $r['factionId'] === $otherFamily))[0];
activityProof($zero['score'] === 0 && $zero['memberCount'] === 1 && $service->snapshot($outsider)['competition']['ownFactionId'] === $otherFamily, 'unscored real family stays visible with zero score and its actual membership');
$db->execute('INSERT INTO family_competition_scores (season_id, faction_id, score, version, updated_at) VALUES (:season, :family, 999, 1, :at)', ['season' => 'previous-season-' . bin2hex(random_bytes(4)), 'family' => $otherFamily, 'at' => gmdate('c')]);
activityProof(array_values(array_filter($service->snapshot($outsider)['competition']['ranks'], fn ($r) => $r['factionId'] === $otherFamily))[0]['score'] === 0, 'past season scores cannot inflate the current weekly competition');

activityResetCooldown($family);
$wh = $service->act('create', 'warehouse-heist', 1, $leader)['result']['operationId'];
$cash = [];
foreach ([$leader, $a, $b] as $participant) {
    $cash[$participant] = activityValue($participant, 'cash');
    activityAct('join', $wh, $participant);
}
activityAct('start', $wh, $leader);
$db->execute('UPDATE family_operations SET ready_at = :ready WHERE id = :id', ['ready' => (time() - 1) * 1000, 'id' => $wh]);
[$settled, $stale] = activityRace('resolve', $wh, activityOp($wh, $leader)['version'], [$a, $b]);
activityProof($settled === 1 && $stale === 1 && array_all([$leader, $a, $b], fn ($p) => activityValue($p, 'cash') === $cash[$p] + 1000), 'three-member warehouse settles 3000 cash as three exact 1000 shares despite resolution race');
$shared = (new FamilyProgressionService($db, $events))->snapshot($leader);
activityProof($shared['respect'] === 65 && count($shared['ledger']) === 2, 'warehouse awards exactly forty-five additional shared respect and one ledger entry');
activityProof(array_values(array_filter($service->snapshot($leader)['competition']['ranks'], fn ($r) => $r['factionId'] === $family))[0]['score'] === 21, 'each successful real operation awards five competition points exactly once');
echo 'FAMILY ACTIVITIES RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;

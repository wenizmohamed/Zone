<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\PlayerCombatService;
$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/player-combat-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback database required.');
}
$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db); $count = 0;
function pvpProof(bool $ok, string $label): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
function pvpReject(callable $fn): bool { try { $fn(); } catch (RuntimeException|InvalidArgumentException) { return true; } return false; }
function pvpPlayer(bool $strong = false): string {
    global $engine, $db;
    $id = $engine->browserSessions()->create('pvp-' . bin2hex(random_bytes(6)))['playerId'];
    $db->execute('UPDATE players SET resources_updated_at = :at WHERE id = :id', ['id' => $id, 'at' => gmdate('c', time() + 3600)]);
    if ($strong) $db->execute('UPDATE players SET strength = 10000, defense = 10000, speed = 10000, dexterity = 10000 WHERE id = :id', ['id' => $id]);
    return $id;
}
function pvpWin($service, string $actor, string $target): array {
    $s = $service->snapshot($actor); $s = $service->act('start', $target, '', $s['version'], $actor);
    while ($s['encounter']['phase'] === 'fighting') $s = $service->act('strike', '', '', $s['version'], $actor);
    pvpProof($s['encounter']['phase'] === 'won', 'server-owned attacker stats can win a genuine two-player encounter');
    return $s;
}
$service = new PlayerCombatService($db, $events, static fn ($min, $max) => $min);
if (($argv[1] ?? '') === '--worker') {
    echo "READY\n"; fflush(STDOUT); fgets(STDIN);
    echo "ATTEMPTING\n"; fflush(STDOUT);
    try {
        $service->act((string) getenv('ZONE_PVP_ACTION'), (string) getenv('ZONE_PVP_TARGET'), (string) getenv('ZONE_PVP_APPROACH'), (int) getenv('ZONE_PVP_VERSION'), (string) getenv('ZONE_PVP_ACTOR'));
        echo "settled\n"; exit(0);
    } catch (RuntimeException $error) {
        if ($error instanceof PDOException) throw $error;
        echo "rejected\n"; exit(10);
    }
}
pvpProof(class_exists(PlayerCombatService::class), 'persistent player combat service is available');
function pvpRace(array $requests, array $lockedIds): array {
    global $db, $url;
    $workers = [];
    foreach ($requests as [$action, $target, $approach, $version, $actor]) {
        $command = [PHP_BINARY]; if ($db->driver() === 'pgsql') array_push($command, '-d', 'extension=pdo_pgsql');
        array_push($command, __FILE__, '--worker');
        $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DEPTH_TEST_URL' => $url, 'ZONE_PVP_ACTION' => $action, 'ZONE_PVP_TARGET' => $target, 'ZONE_PVP_APPROACH' => $approach, 'ZONE_PVP_VERSION' => (string) $version, 'ZONE_PVP_ACTOR' => $actor], ['bypass_shell' => true]);
        if (!is_resource($process)) throw new RuntimeException('Unable to launch real PvP worker.');
        stream_set_timeout($pipes[1], 15);
        if (trim((string) fgets($pipes[1])) !== 'READY') throw new RuntimeException('PvP worker not ready: ' . stream_get_contents($pipes[2]));
        $workers[] = [$process, $pipes];
    }
    $db->playersTransaction($lockedIds, function () use ($workers): void {
        foreach ($workers as [$process, $pipes]) { fwrite($pipes[0], "GO\n"); fflush($pipes[0]); }
        foreach ($workers as [$process, $pipes]) if (trim((string) fgets($pipes[1])) !== 'ATTEMPTING') throw new RuntimeException('Worker did not reach combat action.');
        usleep(150000);
        foreach ($workers as [$process]) if (!proc_get_status($process)['running']) throw new RuntimeException('Combat worker bypassed held player locks.');
    });
    $settled = 0; $rejected = 0;
    foreach ($workers as [$process, $pipes]) {
        fclose($pipes[0]); $out = trim(stream_get_contents($pipes[1])); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $exit = proc_close($process);
        if ($exit === 0 && $out === 'settled') $settled++;
        elseif ($exit === 10 && $out === 'rejected') $rejected++;
        else throw new RuntimeException('PvP worker failure: ' . $out . $error);
    }
    return [$settled, $rejected];
}
$a = pvpPlayer(); $b = pvpPlayer(); $third = pvpPlayer();
$s = $service->snapshot($a);
pvpProof($s['version'] === 1 && $s['encounter'] === null, 'new player starts with an empty persisted versioned PvP encounter');
pvpProof(pvpReject(fn () => $service->act('start', $a, '', 1, $a)) && pvpReject(fn () => $service->act('start', 'missing-player', '', 1, $a)), 'self and missing counterparties cannot spend energy');
$listing = $service->opponents($a); $row = array_values(array_filter($listing['players'], fn ($p) => $p['id'] === $b))[0];
pvpProof($listing['selfId'] === $a && $listing['energyCost'] === 25 && $row['eligible'] && !isset($row['cash'], $row['state_json'], $row['password_hash']) && !in_array($a, array_column($listing['players'], 'id'), true), 'opponent listing exposes real selectable players and bounded public stats');
$fight = $service->act('start', $b, '', $s['version'], $a);
pvpProof($fight['player']['energy'] === 75 && $engine->player($b)['energy'] === 100 && $fight['encounter']['kind'] === 'player', 'start spends only attacker 25 energy and reserves a real defender');
pvpProof($service->snapshot($b)['incoming']['attackerId'] === $a && $service->snapshot($b)['incoming']['encounterId'] === $fight['encounter']['id'], 'defender sees the persisted incoming encounter');
pvpProof(pvpReject(fn () => $service->act('start', $b, '', 1, $third)) && pvpReject(fn () => $service->act('start', $a, '', 1, $b)) && $engine->player($third)['energy'] === 100, 'conflicting and reverse fights cannot debit or replace reservations');
pvpProof((new PlayerCombatService($db, $events))->snapshot($a)['encounter']['id'] === $fight['encounter']['id'], 'a new service instance resumes the same real opponent and round state');
$round = $service->act('strike', '', '', $fight['version'], $a);
pvpProof($round['encounter']['turn'] === 1 && $round['player']['life'] === 202 && $engine->player($b)['life'] === 202, 'paired strike writes damage to both real player life balances');
pvpProof(pvpReject(fn () => $service->act('strike', '', '', $fight['version'], $a)) && $engine->player($b)['life'] === 202, 'stale strike cannot damage defender twice');
$left = $service->act('finish', '', 'leave', $round['version'], $a);
pvpProof($left['encounter'] === null && $left['player']['energy'] === 75 && $left['player']['life'] === 202 && $service->snapshot($b)['incoming'] === null, 'forfeit preserves paid energy and damage while releasing both reservations');
pvpProof(pvpReject(fn () => $service->act('start', $b, '', $left['version'], $a)), 'the normal attack cooldown survives forfeit');
$mugger = pvpPlayer(true); $victim = pvpPlayer();
$won = pvpWin($service, $mugger, $victim);
$mugged = $service->act('finish', '', 'mug', $won['version'], $mugger);
pvpProof($mugged['result']['cashDelta'] === 125 && $engine->player($mugger)['cash'] === 2625 && $engine->player($victim)['cash'] === 2375, 'mug transfers current defender wallet cash without minting money');
$entries = $db->fetchAll('SELECT player_id, amount, correlation_id FROM economy_ledger WHERE correlation_id = :id', ['id' => $mugged['result']['correlationId']]);
pvpProof(count($entries) === 2 && array_sum(array_column($entries, 'amount')) === 0, 'paired mug ledger debits and credits reconcile under one correlation');
pvpProof($engine->gameplay($mugger)['state']['ctr']['wins'] === 1 && $engine->player($mugger)['xp'] === 3 && $engine->gameplay($victim)['state']['hospUntil'] > time() * 1000, 'real win XP and defender mug hospitalization settle once');
pvpProof(pvpReject(fn () => $service->act('finish', '', 'mug', $won['version'], $mugger)) && $engine->player($victim)['cash'] === 2375, 'replayed mug finish cannot steal cash twice');
$healed = $engine->hospitalHeal($victim);
pvpProof($healed['player']['life'] === 250 && $engine->gameplay($victim)['state']['hospUntil'] === 0, 'the real defender can recover through the existing paid hospital service');
$hitter = pvpPlayer(true); $patient = pvpPlayer(); $engine->joinFaction('vipers', $hitter);
$won = pvpWin($service, $hitter, $patient); $hospital = $service->act('finish', '', 'hosp', $won['version'], $hitter);
pvpProof($hospital['result']['respectDelta'] === 26 && $hospital['result']['cashDelta'] === 0 && $engine->gameplay($hitter)['state']['fac']['respect'] === 26, 'human hospitalization earns trusted respect and no fabricated mug cash');
pvpProof($engine->gameplay($patient)['state']['hospUntil'] >= time() * 1000 + 590000 && $engine->gameplay($hitter)['family']['respect'] >= 26, 'real defender receives ten-minute hospital time and family receives earned respect');
$loser = pvpPlayer(); $winner = pvpPlayer(); $db->execute('UPDATE players SET life = 1 WHERE id = :id', ['id' => $loser]);
$lost = $service->act('start', $winner, '', 1, $loser); $lost = $service->act('strike', '', '', $lost['version'], $loser);
pvpProof($lost['encounter']['phase'] === 'lost' && $engine->player($loser)['life'] === 0 && $engine->gameplay($loser)['state']['hospUntil'] > time() * 1000, 'losing player is actually damaged and hospitalized');
pvpProof(pvpReject(fn () => $service->act('finish', '', 'mug', $lost['version'], $loser)), 'a lost encounter cannot mug a human defender');
$service->act('finish', '', 'leave', $lost['version'], $loser);
pvpProof($service->snapshot($winner)['incoming'] === null && $engine->gameplay($loser)['state']['ctr']['wins'] === 0, 'losing forfeit releases defender without awarding a false attacker win');
$misses = new PlayerCombatService($db, $events, static fn ($min, $max) => $max);
$drawA = pvpPlayer(); $drawB = pvpPlayer(); $draw = $misses->act('start', $drawB, '', 1, $drawA);
while ($draw['encounter']['phase'] === 'fighting') $draw = $misses->act('strike', '', '', $draw['version'], $drawA);
pvpProof($draw['encounter']['phase'] === 'stalemate' && $draw['encounter']['turn'] === 25 && $engine->player($drawA)['life'] === 250 && $engine->player($drawB)['life'] === 250, '25 real paired rounds terminate stalemate without invented damage');
$drawFinish = $misses->act('finish', '', 'leave', $draw['version'], $drawA);
pvpProof($drawFinish['result']['xp'] === 0 && $drawFinish['result']['cashDelta'] === 0 && $service->snapshot($drawB)['incoming'] === null, 'stalemate releases both players with no reward or energy refund');
$clock = time(); $timed = new PlayerCombatService($db, $events, static fn ($min, $max) => $min, static function () use (&$clock): int { return $clock; });
$expiryA = pvpPlayer(); $expiryB = pvpPlayer(); $expiry = $timed->act('start', $expiryB, '', 1, $expiryA); $clock += 901;
$expired = $timed->snapshot($expiryB);
pvpProof($expired['incoming'] === null && $timed->snapshot($expiryA)['encounter'] === null && $engine->player($expiryA)['energy'] === 75, 'fifteen-minute expiry releases both reservations without refund or reward');
pvpProof(pvpReject(fn () => $timed->act('strike', '', '', $expiry['version'], $expiryA)), 'expired encounter version cannot resume stale damage');
$gearA = pvpPlayer(); $gearB = pvpPlayer();
$progression = new \Zone\Engine\Core\Game\ProgressionService($db, $events);
$progression->grantItem($gearA, 'revolver'); $progression->grantItem($gearA, 'vest'); $progression->grantItem($gearB, 'revolver'); $progression->grantItem($gearB, 'armor');
foreach ([$gearA, $gearB] as $id) $engine->gameplayAction('item.equip', 'revolver', $engine->gameplay($id)['state']['version'], $id);
$geared = $service->act('start', $gearB, '', 1, $gearA); $geared = $service->act('strike', '', '', $geared['version'], $gearA);
pvpProof($geared['player']['life'] === 182 && $engine->player($gearB)['life'] === 172, 'each real owned revolver and armor applies symmetrically to paired damage');
$service->act('finish', '', 'leave', $geared['version'], $gearA);
$poorA = pvpPlayer(true); $poorB = pvpPlayer(); $poor = pvpWin($service, $poorA, $poorB);
$db->execute('UPDATE players SET cash = 1000 WHERE id = :id', ['id' => $poorB]);
$poor = $service->act('finish', '', 'mug', $poor['version'], $poorA);
pvpProof($poor['result']['cashDelta'] === 50 && $engine->player($poorB)['cash'] === 950, 'mug amount uses current locked defender wallet rather than start snapshot');
$leaveA = pvpPlayer(true); $leaveB = pvpPlayer(); $leave = pvpWin($service, $leaveA, $leaveB); $leave = $service->act('finish', '', 'leave', $leave['version'], $leaveA);
pvpProof($leave['result']['xp'] === 3 && $leave['result']['cashDelta'] === 0 && $leave['result']['respectDelta'] === 0 && $engine->gameplay($leaveB)['state']['hospUntil'] >= time() * 1000 + 110000, 'won leave awards normal XP with real two-minute recovery and no cash or respect');
$busyA = pvpPlayer(); $busyB = pvpPlayer(); $progression->applyPenalty($busyB, 'jail', 10);
pvpProof(pvpReject(fn () => $service->act('start', $busyB, '', 1, $busyA)) && $engine->player($busyA)['energy'] === 100, 'jail eligibility rejects real defender before energy debit');
$travelA = pvpPlayer(); $travelB = pvpPlayer(); (new \Zone\Engine\Core\Game\TravelService($db, $events))->depart($travelB, 'Zone City', 'Cairo', 300);
pvpProof(pvpReject(fn () => $service->act('start', $travelB, '', 1, $travelA)) && $engine->player($travelA)['energy'] === 100, 'traveling defender is unavailable before combat payment');
$raceA = pvpPlayer(); $raceB = pvpPlayer(); $raceTarget = pvpPlayer();
$race = pvpRace([['start', $raceTarget, '', 1, $raceA], ['start', $raceTarget, '', 1, $raceB]], [$raceA, $raceB, $raceTarget]);
pvpProof($race === [1, 1] && $engine->player($raceA)['energy'] + $engine->player($raceB)['energy'] === 175 && count($db->fetchAll('SELECT player_id FROM player_combat_locks WHERE defender_id = :id', ['id' => $raceTarget])) === 2, 'parallel attackers wait for canonical locks and exactly one reserves defender and pays');
$reverseA = pvpPlayer(); $reverseB = pvpPlayer();
$race = pvpRace([['start', $reverseB, '', 1, $reverseA], ['start', $reverseA, '', 1, $reverseB]], [$reverseA, $reverseB]);
pvpProof($race === [1, 1] && $engine->player($reverseA)['energy'] + $engine->player($reverseB)['energy'] === 175, 'simultaneous reverse attacks settle one fight without a deadlock or double energy debit');
$duplicateA = pvpPlayer(true); $duplicateB = pvpPlayer(); $won = pvpWin($service, $duplicateA, $duplicateB);
$race = pvpRace([['finish', '', 'mug', $won['version'], $duplicateA], ['finish', '', 'mug', $won['version'], $duplicateA]], [$duplicateA, $duplicateB]);
pvpProof($race === [1, 1] && $engine->player($duplicateA)['cash'] === 2625 && $engine->player($duplicateB)['cash'] === 2375 && $engine->gameplay($duplicateA)['state']['ctr']['wins'] === 1, 'concurrent duplicate mug finish settles one real transfer and one win only');
$resolved = array_filter($db->fetchAll("SELECT payload_json FROM event_log WHERE event_name = 'PlayerCombatResolved'"), fn ($row) => json_decode($row['payload_json'], true)['playerId'] === $duplicateA);
pvpProof(count($resolved) === 1 && json_decode(array_values($resolved)[0]['payload_json'], true)['defenderId'] === $duplicateB, 'trusted PlayerCombatResolved event names the real counterparty exactly once');
$emptyA = pvpPlayer(true); $emptyB = pvpPlayer(); $won = pvpWin($service, $emptyA, $emptyB); $db->execute('UPDATE players SET cash = 0 WHERE id = :id', ['id' => $emptyB]);
$empty = $service->act('finish', '', 'mug', $won['version'], $emptyA);
pvpProof($empty['result']['cashDelta'] === 0 && $engine->player($emptyA)['cash'] === 2500 && $engine->player($emptyB)['cash'] === 0 && $empty['result']['xp'] === 3, 'empty real wallet grants no minted mug cash while a real win still grants XP');
$clock = time(); $expiryWinner = pvpPlayer(true); $expiryDowned = pvpPlayer(); $won = pvpWin($timed, $expiryWinner, $expiryDowned); $clock += 901;
$timed->snapshot($expiryDowned);
pvpProof($timed->snapshot($expiryWinner)['encounter'] === null && $engine->gameplay($expiryWinner)['state']['ctr']['wins'] === 0 && $engine->player($expiryWinner)['cash'] === 2500 && $engine->gameplay($expiryDowned)['state']['hospUntil'] > time() * 1000, 'abandoned won fight expires into defender recovery without automatic reward or refund');
$atomicA = pvpPlayer(true); $atomicB = pvpPlayer(); $won = pvpWin($service, $atomicA, $atomicB);
$failingEvents = new EventBus($db);
$failingEvents->subscribe(new class implements \Zone\Engine\Core\Contracts\EventSubscriber {
    public function eventName(): string { return 'PlayerCombatResolved'; }
    public function handle(\Zone\Engine\Core\Events\DomainEvent $event): void { throw new RuntimeException('Injected settlement subscriber failure.'); }
});
$failingService = new PlayerCombatService($db, $failingEvents, static fn ($min, $max) => $min);
pvpProof(pvpReject(fn () => $failingService->act('finish', '', 'mug', $won['version'], $atomicA)) && $engine->player($atomicA)['cash'] === 2500 && $engine->player($atomicB)['cash'] === 2500 && $engine->gameplay($atomicA)['state']['ctr']['wins'] === 0 && $service->snapshot($atomicA)['version'] === $won['version'] && $service->snapshot($atomicB)['incoming'] !== null, 'subscriber failure rolls back both wallets, win, encounter version and reservations atomically');
$retry = $service->act('finish', '', 'mug', $won['version'], $atomicA);
pvpProof($retry['result']['cashDelta'] === 125 && $engine->gameplay($atomicA)['state']['ctr']['wins'] === 1, 'failed settlement can retry the same version and award exactly one win');
echo 'PLAYER COMBAT RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;

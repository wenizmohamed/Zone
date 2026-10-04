<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CombatService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Persistence\Database;

$path = dirname(__DIR__) . '/var/combat-' . bin2hex(random_bytes(6)) . '.sqlite';
$engine = zone_engine('sqlite:' . $path);
$db = Database::connect('sqlite:' . $path);
$service = new CombatService($db, new EventBus($db), static fn (int $min, int $max): int => $min);
$progression = new ProgressionService($db, new EventBus($db));
$player = 'founder-player'; $passed = 0;
function combatCheck(bool $ok, string $message): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $message); $passed++; echo 'PASS: ' . $message . PHP_EOL; }
function combatReject(callable $fn, string $prefix): bool { try { $fn(); } catch (RuntimeException $error) { return str_starts_with($error->getMessage(), $prefix); } return false; }
function winEncounter($db, $service, string $player): array {
    $db->execute('DELETE FROM action_cooldowns');
    $db->execute('UPDATE players SET strength = 10000000, defense = 10000000, speed = 10000000, dexterity = 10000000, energy = 150, life = 3000 WHERE id = :id', ['id' => $player]);
    $state = $service->snapshot($player);
    $state = $service->act('start', 'rayan', '', $state['version'], $player);
    while ($state['encounter']['phase'] === 'fighting') $state = $service->act('strike', '', '', $state['version'], $player);
    return $state;
}
try {
    $initial = $service->snapshot($player);
    combatCheck($initial['encounter'] === null && $initial['version'] === 1, 'new player receives empty versioned encounter');
    try { $service->act('start', 'forged-opponent', '', 1, $player); $unknown = false; } catch (InvalidArgumentException) { $unknown = true; }
    combatCheck($unknown && $service->snapshot($player)['player']['energy'] === $initial['player']['energy'], 'unknown opponent cannot spend energy');
    $start = $service->act('start', 'rayan', '', 1, $player);
    combatCheck($start['player']['energy'] === $initial['player']['energy'] - 25 && $start['encounter']['enemyHp'] === 900, 'server catalog controls starting life and energy cost');
    combatCheck(combatReject(fn () => $service->act('strike', '', '', 1, $player), 'Combat state changed.'), 'stale tab cannot strike a newer encounter');
    combatCheck(combatReject(fn () => $service->act('start', 'sal', '', $start['version'], $player), 'Finish the current encounter'), 'duplicate start cannot replace a live encounter');
    combatCheck((new CombatService($db, new EventBus($db)))->snapshot($player)['encounter']['id'] === $start['encounter']['id'], 'encounter survives service reconstruction');
    $round = $service->act('strike', '', '', $start['version'], $player);
    combatCheck($round['encounter']['turn'] === 1 && count($round['encounter']['log']) === 2, 'strike advances exactly one paired round');
    combatCheck($round['player']['life'] === $round['encounter']['playerHp'], 'round damage persists in authoritative player life');
    $left = $service->act('finish', '', 'leave', $round['version'], $player);
    combatCheck($left['encounter'] === null && $left['result']['cashDelta'] === 0 && $left['player']['energy'] === $start['player']['energy'], 'forfeit clears encounter without refund or reward');
    $win = winEncounter($db, $service, $player);
    combatCheck($win['encounter']['phase'] === 'won' && $win['encounter']['turn'] <= 25, 'server stats and owned weapon can win within round limit');
    $cash = $win['player']['cash'];
    $mug = $service->act('finish', '', 'mug', $win['version'], $player);
    combatCheck($mug['result']['cashDelta'] === 1900 && $mug['player']['cash'] === $cash + 1900, 'mug pays server catalog amount exactly once');
    combatCheck($mug['result']['xp'] === 27 && $mug['result']['respectDelta'] === 0, 'mug grants XP but no hospital respect');
    combatCheck(combatReject(fn () => $service->act('finish', '', 'mug', $win['version'], $player), 'Combat state changed.'), 'replayed finish cannot duplicate payout');
    combatCheck(count($db->fetchAll("SELECT * FROM economy_ledger WHERE reason = 'combat.mug'")) === 1, 'one mug creates one correlated ledger entry');
    $win = winEncounter($db, $service, $player);
    $hospital = $service->act('finish', '', 'hosp', $win['version'], $player);
    combatCheck($hospital['result']['respectDelta'] === 34 && $hospital['result']['cashDelta'] === 0, 'hospital finish grants target-level respect instead of cash');
    $win = winEncounter($db, $service, $player);
    $left = $service->act('finish', '', 'leave', $win['version'], $player);
    combatCheck($left['result']['xp'] === 27 && $left['result']['cashDelta'] === 0 && $left['result']['respectDelta'] === 0, 'leaving a won fight preserves XP without mug or respect rewards');
    combatCheck($progression->snapshot($player)['state']['ctr']['wins'] === 3, 'three distinct winning finishes increment mission wins three times');
    $db->execute('DELETE FROM action_cooldowns');
    $db->execute('UPDATE players SET strength = 1, defense = 1, speed = 1, dexterity = 1, energy = 150, life = 1, resources_updated_at = :now WHERE id = :id', ['id' => $player, 'now' => gmdate('c')]);
    $start = $service->act('start', 'sal', '', $left['version'], $player);
    $lost = $service->act('strike', '', '', $start['version'], $player);
    combatCheck($lost['encounter']['phase'] === 'lost' && $lost['player']['life'] === 0, 'losing round persists zero life');
    combatCheck($progression->snapshot($player)['state']['hospUntil'] > time() * 1000, 'losing fight persists a hospital timer');
    combatCheck(combatReject(fn () => $service->act('finish', '', 'mug', $lost['version'], $player), 'Only a won encounter'), 'losing fight cannot claim a mug reward');
    $service->act('finish', '', 'leave', $lost['version'], $player);
    combatCheck(combatReject(fn () => $engine->bankDeposit(1), 'You must leave jail or hospital'), 'hospital status also blocks other authoritative actions');
    $healed = $engine->hospitalHeal($player);
    combatCheck($healed['player']['life'] === 3000 && $progression->snapshot($player)['state']['hospUntil'] === 0, 'paid healing restores life and clears hospital timer');
    $db->execute("UPDATE territory_control SET faction_id = 'vipers', state = 'owned', control_basis_points = 10000 WHERE territory_id IN (SELECT id FROM territory_blocks WHERE benefit_key = 'defense')");
    $db->execute('DELETE FROM action_cooldowns');
    $snapshot = $service->snapshot($player);
    $defended = $service->act('start', 'rayan', '', $snapshot['version'], $player);
    combatCheck($defended['encounter']['territoryDefenseBasisPoints'] === 2000, 'territory defense contributes at most 20 percent to combat');
    $left = $service->act('finish', '', 'leave', $defended['version'], $player);
    $engine->changeModule('territories', 'disable'); $engine->publishRelease('fixture');
    $db->execute('DELETE FROM action_cooldowns');
    $defended = $service->act('start', 'rayan', '', $left['version'], $player);
    combatCheck($defended['encounter']['territoryDefenseBasisPoints'] === 0, 'published territory disable removes combat defense modifier');
    echo "COMBAT RESULT: {$passed} passed, 0 failed\n";
} catch (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL); exit(1); }

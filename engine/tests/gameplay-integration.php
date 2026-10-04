<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\TravelService;
use Zone\Engine\Core\Persistence\Database;

$path = dirname(__DIR__) . '/var/gameplay-integration-' . bin2hex(random_bytes(6)) . '.sqlite';
$engine = zone_engine('sqlite:' . $path);
$db = Database::connect('sqlite:' . $path);
$passed = 0;
function integrated(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function refuses(callable $fn, string $prefix): bool { try { $fn(); } catch (Throwable $error) { return str_starts_with($error->getMessage(), $prefix); } return false; }
function stateFixture($db, callable $fn): void { $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'"); $state = json_decode($row['state_json'], true); $state = $fn($state); $db->execute("UPDATE player_progression SET state_json = :state, version = version + 1 WHERE player_id = 'founder-player'", ['state' => json_encode($state)]); }
try {
    $state = $engine->gameplay();
    integrated(count($engine->crimes()) === 31, 'fresh engine exposes 7 main crimes and all 24 preserved variants');
    $variant = array_values(array_filter($engine->crimes(), static fn (array $c): bool => $c['id'] === 'trash'))[0];
    integrated($variant['category'] === 'search' && $variant['failure'] === 'jail' && isset($variant['description']['ar']), 'published variant retains category, bilingual description and failure type');
    integrated(refuses(fn () => $engine->attemptCrime('eldm'), 'Earn more crime experience'), 'server gates category by persisted crime XP');
    $db->execute("UPDATE players SET level = 1, xp = 0 WHERE id = 'founder-player'");
    $db->execute("DELETE FROM faction_members WHERE player_id = 'founder-player'");
    $crime = array_values(array_filter($engine->adminCrimes(), static fn (array $c): bool => $c['id'] === 'trash'))[0];
    $engine->saveCrime('trash', [...$crime, 'success_basis_points' => 0], 'fixture');
    $engine->publishRelease('fixture');
    $failed = $engine->attemptCrime('trash');
    integrated(!$failed['success'] && $failed['penalty'] === ['type' => 'jail', 'minutes' => 2], 'failed variant returns its exact server penalty');
    integrated($engine->gameplay()['state']['jailUntil'] > time() * 1000, 'failed crime persists jail across snapshots');
    integrated(refuses(fn () => $engine->bankDeposit(1), 'You must leave jail or hospital'), 'jail status blocks cross-module actions');
    $state = $engine->gameplay();
    $bailed = $engine->gameplayAction('jail.bailSelf', '', $state['state']['version']);
    integrated($bailed['state']['jailUntil'] === 0 && $bailed['player']['cash'] < $state['player']['cash'], 'self bail clears jail and debits the server wallet');
    $db->execute("UPDATE players SET level = 12, energy = 150 WHERE id = 'founder-player'");
    $state = $engine->gameplay();
    $engine->gameplayAction('job.take', 'clinic', $state['state']['version']);
    $before = $engine->player();
    $shift = $engine->workShift();
    integrated($shift['jobId'] === 'clinic' && $shift['reward']['cash'] === 4200 && $shift['player']['energy'] === $before['energy'] - 20, 'selected clinic job controls authoritative wage and energy cost');
    stateFixture($db, static function (array $state): array { $state['eduDone']['biz'] = 1; return $state; });
    $db->execute('DELETE FROM action_cooldowns');
    integrated($engine->workShift()['reward']['cash'] === 4620, 'completed business course applies its 10 percent wage bonus');
    stateFixture($db, static function (array $state): array { $state['gymXp'] = 2200; return $state; });
    $state = $engine->gameplay();
    $engine->gameplayAction('gym.join', '7', $state['state']['version']);
    $before = $engine->player();
    $trained = $engine->trainGym('strength');
    integrated($trained['cost']['energy'] === 10 && $trained['player']['energy'] === $before['energy'] - 10, 'selected advanced gym controls training energy cost');
    integrated($engine->gameplay()['state']['ctr']['trains'] === 1, 'server gym training advances mission progress once');
    $db->execute('DELETE FROM action_cooldowns');
    $before = $engine->player();
    $trip = $engine->travel('Dubai');
    integrated($trip['player']['city'] === $before['city'] && $trip['travel']['status'] === 'traveling' && $trip['travel']['remainingSeconds'] > 0, 'travel departure persists a pending trip without teleporting');
    integrated($trip['player']['cash'] === $before['cash'] - 2500, 'departure debits its fare exactly once');
    $db->execute('DELETE FROM action_cooldowns');
    integrated(refuses(fn () => $engine->travel('Riyadh'), 'You are traveling'), 'second departure cannot replace a pending paid trip');
    integrated(refuses(fn () => $engine->trainGym('strength'), 'You are traveling'), 'travel blocks resource actions');
    $state = $engine->gameplay();
    integrated(refuses(fn () => $engine->gameplayAction('item.buy', 'drink', $state['state']['version']), 'You are traveling'), 'travel blocks new progression wallet actions too');
    $clock = strtotime($trip['travel']['arrivesAt']) - 1;
    $travel = new TravelService($db, new EventBus($db), static function () use (&$clock): int { return $clock; });
    integrated($travel->snapshot('founder-player')['status'] === 'traveling', 'trip cannot arrive one second early');
    $clock++;
    integrated($travel->snapshot('founder-player')['status'] === 'arrived' && $engine->player()['city'] === 'Dubai', 'server clock reaching arrival settles destination');
    $travel->snapshot('founder-player');
    integrated(count($db->fetchAll("SELECT id FROM event_log WHERE event_name = 'PlayerArrived'")) === 1, 'repeated arrival reads publish only one arrival event');
    $manifest = $engine->releaseDraft()['manifest'];
    foreach (['items', 'market', 'education', 'jobs', 'missions', 'faction'] as $screen) $manifest['modules'][$screen] = false;
    $engine->saveReleaseDraft($manifest, 'fixture'); $engine->publishRelease('fixture');
    foreach (['item.buy' => 'drink', 'market.buy' => 'drink', 'course.enroll' => 'fit', 'job.take' => 'grocer', 'mission.claim' => 'first', 'faction.upgrade' => 'gymBoost'] as $action => $id) {
        integrated(refuses(fn () => $engine->gameplayAction($action, $id, $engine->gameplay()['state']['version']), 'Module '), 'published screen disable blocks ' . $action);
    }
    integrated(refuses(fn () => $engine->workShift(), 'Module jobs'), 'disabled jobs screen blocks the existing work endpoint');
    $db->insertIgnore('faction_members', ['player_id', 'faction_id', 'role', 'joined_at'], ['founder-player', 'vipers', 'leader', gmdate('c')]);
    $db->execute("UPDATE territory_control SET faction_id = 'vipers', state = 'owned', control_basis_points = 10000 WHERE territory_id IN (SELECT id FROM territory_blocks WHERE benefit_key = 'medical_discount')");
    $db->execute("UPDATE players SET life = max_life - 100 WHERE id = 'founder-player'");
    $quote = $engine->hospitalQuote();
    integrated($quote['territoryDiscountBasisPoints'] === 5000 && $quote['baseCost'] === 300 && $quote['cost'] === 150, 'medical territory bonus caps at 50 percent in the authoritative quote');
    $healed = $engine->hospitalHeal();
    integrated($healed['cost']['cash'] === $quote['cost'], 'medical treatment charges the quoted discounted price');
    $engine->changeModule('territories', 'disable');
    $engine->publishRelease('fixture');
    $db->execute("UPDATE players SET life = max_life - 100 WHERE id = 'founder-player'");
    integrated($engine->hospitalQuote()['cost'] === 300, 'published territory disable removes the passive medical discount');
    echo "GAMEPLAY INTEGRATION RESULT: {$passed} passed, 0 failed\n";
} catch (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL); exit(1); }

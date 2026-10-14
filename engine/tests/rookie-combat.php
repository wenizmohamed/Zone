<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CombatService;
$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/rookie-combat-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback database required.');
}
$engine = zone_engine($url); $db = Database::connect($url); $events = new EventBus($db); $count = 0;
function rookieProof(bool $ok, string $label): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
function rookieFight($engine, $db, $events, Closure $random): array {
    $id = $engine->browserSessions()->create('rookie-' . bin2hex(random_bytes(6)))['playerId'];
    $service = new CombatService($db, $events, $random); $before = $service->snapshot($id);
    rookieProof($before['player']['strength'] === 10 && $before['player']['defense'] === 10 && $before['player']['speed'] === 10 && $before['player']['dexterity'] === 10 && $before['player']['life'] === 250, 'fight begins with unchanged real novice stats and life');
    $fight = $service->act('start', 'dockside-rookie', '', $before['version'], $id);
    rookieProof($fight['player']['energy'] === 75, 'rookie encounter spends the normal25energy without a starter exception');
    while ($fight['encounter']['phase'] === 'fighting') $fight = $service->act('strike', '', '', $fight['version'], $id);
    return [$id, $service, $fight];
}
$foundation = json_decode((string) file_get_contents(ZONE_ENGINE_ROOT . '/data/gameplay-catalog.json'), true, 512, JSON_THROW_ON_ERROR);
$rookie = array_values(array_filter($foundation['opponents'], fn ($o) => $o['id'] === 'dockside-rookie'))[0] ?? null;
rookieProof($rookie !== null, 'foundation supplies an original novice combat opponent');
// Existing isolated PG catalogs are immutable too. Exercise the same owner create/publish path used for the local app.
if (!in_array('dockside-rookie', array_column($engine->gameplay()['catalogs']['opponents'], 'id'), true)) {
    $definition = $rookie; unset($definition['id']);
    $engine->createGameplayCatalog('opponents', 'dockside-rookie', $definition, $engine->adminGameplayCatalog()['revision'], 'isolated-rookie-test');
    $engine->publishRelease('isolated-rookie-test');
}
$hits = 0;
[$player, $service, $fight] = rookieFight($engine, $db, $events, static function ($min, $max) use (&$hits): int { return $max === 10000 ? (++$hits % 2 === 1 ? 1 : 10000) : $min; });
rookieProof($fight['encounter']['phase'] === 'won' && $fight['encounter']['turn'] <= 3 && $fight['player']['life'] > 0, 'novice fists can earn a real victory within three paired rounds');
$finished = $service->act('finish', '', 'mug', $fight['version'], $player);
rookieProof($finished['result']['cashDelta'] === 60 && $finished['result']['xp'] === 3, 'rookie finish pays modest published cash and normal level-based XP');
$guide = $engine->gameplay($player);
rookieProof($guide['state']['ctr']['wins'] === 1 && array_values(array_filter($guide['onboarding']['steps'], fn ($s) => $s['missionId'] === 'w1'))[0]['claimable'], 'real first-session victory unlocks first-blood mission readiness');
$reward = $engine->gameplayAction('mission.claim', 'w1', $guide['state']['version'], $player);
rookieProof($reward['result']['cashDelta'] === 8000 && $reward['state']['claimed']['w1'] === 1, 'rookie victory uses existing exactly-once first-blood reward settlement');
$hits = 0;
[$loser, $losingService, $lost] = rookieFight($engine, $db, $events, static function ($min, $max) use (&$hits): int { return $max === 10000 ? (++$hits % 2 === 1 ? 10000 : 1) : $max; });
rookieProof($lost['encounter']['phase'] === 'lost' && $lost['player']['life'] === 0 && $engine->gameplay($loser)['state']['hospUntil'] > time() * 1000, 'legal unfavorable rolls can defeat and hospitalize the same novice without guaranteed-win logic');
rookieProof($engine->gameplay($loser)['state']['ctr']['wins'] === 0, 'rookie defeat cannot count as a first-blood victory');
echo 'ROOKIE COMBAT RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;

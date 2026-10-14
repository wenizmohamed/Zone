<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ProgressionService;

$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/beta-depth-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback database required.');
}
$db = Database::connect($url); $engine = zone_engine($url); $events = new EventBus($db); $progress = new ProgressionService($db, $events);
if (($argv[1] ?? '') === '--upgrade-worker') {
    try {
        $progress->act('faction.sharedUpgrade', 'energyMax', (int) getenv('ZONE_DEPTH_WORKER_VERSION'), (string) getenv('ZONE_DEPTH_WORKER_PLAYER'), (int) getenv('ZONE_DEPTH_WORKER_FAMILY_VERSION'));
        echo "settled\n"; exit(0);
    } catch (RuntimeException $error) {
        if (str_contains($error->getMessage(), 'changed') || str_contains($error->getMessage(), 'already owned')) { echo "stale\n"; exit(10); }
        throw $error;
    }
}
$count = 0;
function depthProof(bool $ok, string $label): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
function depthReject(callable $fn): bool { try { $fn(); } catch (RuntimeException|InvalidArgumentException) { return true; } return false; }
function depthAct(string $action, string $id, string $player): array { global $progress; $s = $progress->snapshot($player); return $progress->act($action, $id, $s['state']['version'], $player, $s['family']['version'] ?? null); }
$a = $engine->browserSessions()->create('depth-a-' . bin2hex(random_bytes(6)))['playerId'];
$b = $engine->browserSessions()->create('depth-b-' . bin2hex(random_bytes(6)))['playerId'];
$leader = $engine->browserSessions()->create('depth-leader-' . bin2hex(random_bytes(6)))['playerId'];
$familyId = 'depth-' . bin2hex(random_bytes(6));
$db->execute('INSERT INTO factions (id, name_en, name_ar, color, enabled) VALUES (:id, :en, :ar, :color, 1)', ['id' => $familyId, 'en' => 'Isolated depth family', 'ar' => 'عائلة الاختبار', 'color' => '#334455']);
$engine->joinFaction($familyId, $leader); $engine->joinFaction($familyId, $a); $engine->joinFaction($familyId, $b);
// Controlled legacy personal fixture proves migration does not confiscate an existing balance.
$legacy = $progress->snapshot($leader)['state']; $legacy['fac']['respect'] = 20000; unset($legacy['onboarding']);
$db->execute('UPDATE player_progression SET state_json = :state WHERE player_id = :id', ['state' => json_encode($legacy, JSON_THROW_ON_ERROR), 'id' => $leader]);
$s = $progress->snapshot($a);
depthProof(isset($s['family']) && $s['family']['respect'] === 0, 'new shared family starts without copying founder personal wealth');
depthProof($s['family']['permissions']['contribute'] && !$s['family']['permissions']['buyUpgrade'], 'ordinary member has contribution permission but cannot buy shared upgrades');
depthProof(depthReject(fn () => depthAct('faction.sharedUpgrade', 'gymBoost', $a)), 'member cannot bypass leader upgrade permission');
$founder = $progress->snapshot($leader); $personal = $founder['state']['fac']['respect'];
depthProof($personal === 20000 && isset($founder['state']['onboarding']), 'legacy personal balance survives additive saved onboarding initialization');
$funded = depthAct('faction.contribute', '13000', $leader);
depthProof($funded['family']['respect'] === 13000 && $funded['state']['fac']['respect'] === $personal - 13000, 'explicit contribution debits personal respect and credits shared ledger atomically');
depthProof(depthReject(fn () => $progress->act('faction.contribute', '13000', $founder['state']['version'], $leader, 1)), 'stale contribution cannot debit twice');
$db->execute("UPDATE faction_members SET role = 'officer' WHERE player_id = :id", ['id' => $b]);
$raceVersion = $funded['family']['version']; $workers = [];
foreach ([$leader, $b] as $actor) {
    $view = $progress->snapshot($actor);
    $worker = proc_open([PHP_BINARY, '-d', 'extension=pdo_pgsql', __FILE__, '--upgrade-worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DEPTH_TEST_URL' => $url, 'ZONE_DEPTH_WORKER_PLAYER' => $actor, 'ZONE_DEPTH_WORKER_VERSION' => (string) $view['state']['version'], 'ZONE_DEPTH_WORKER_FAMILY_VERSION' => (string) $raceVersion], ['bypass_shell' => true]);
    if (!is_resource($worker)) throw new RuntimeException('Upgrade worker could not start.'); fclose($pipes[0]); $workers[] = [$worker, $pipes];
}
$settled = 0; $stale = 0;
foreach ($workers as [$worker, $pipes]) {
    $output = trim(stream_get_contents($pipes[1])); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $code = proc_close($worker);
    if ($code === 0 && $output === 'settled') $settled++;
    elseif ($code === 10 && $output === 'stale') $stale++;
    else throw new RuntimeException('Shared upgrade worker failed: ' . $output . $error);
}
depthProof($settled === 1 && $stale === 1, 'two distinct authorized players racing spend shared respect exactly once');
$db->execute("UPDATE faction_members SET role = 'member' WHERE player_id = :id", ['id' => $b]);
$up = $progress->snapshot($leader);
depthProof($up['family']['respect'] === 1000 && $up['family']['upgrades']['energyMax'] === 1, 'leader spends shared respect once on catalog upgrade');
$member = $progress->snapshot($a);
depthProof($member['player']['max_energy'] === 110 && empty($member['state']['fac']['ups']['energyMax']), 'shared upgrade reaches second player while personal upgrade state stays separate');
depthProof($progress->snapshot($a)['player']['max_energy'] === 110 && (new ProgressionService($db, $events))->snapshot($a)['player']['max_energy'] === 110, 'shared capacity applies exactly once across reloads');
depthProof(depthReject(fn () => depthAct('faction.sharedUpgrade', 'energyMax', $leader)), 'duplicate shared upgrade cannot consume respect');
$respect = $progress->recordCombatWin($a, 9, 'hosp');
$afterWin = $progress->snapshot($b);
depthProof($respect === 34 && $afterWin['family']['respect'] === 1034, 'earned combat respect appears in another real member shared account');
depthProof(count($afterWin['family']['ledger']) === 3 && $afterWin['family']['contributions'][0]['respect'] === 13000, 'shared ledger records real contribution upgrade spend and combat award');
depthProof($member['onboarding']['currentMissionId'] === 'c5' && !$member['onboarding']['steps'][0]['claimable'], 'saved onboarding starts on an unearned objective with honest eligibility');
depthProof(depthReject(fn () => depthAct('mission.claim', 'c5', $a)), 'unearned onboarding mission cannot pay');
for ($i = 0; $i < 5; $i++) $progress->recordCrime($a, 'searchforcash', true);
$ready = $progress->snapshot($a);
depthProof($ready['onboarding']['steps'][0]['claimable'], 'five real successful counter updates unlock first onboarding objective');
$travel = new \Zone\Engine\Core\Game\TravelService($db, $events);
$travel->depart($a, 'Zone City', 'Cairo', 600);
depthProof(!$progress->snapshot($a)['onboarding']['steps'][0]['claimable'] && $progress->snapshot($a)['onboarding']['steps'][0]['reason'] === 'travel_required', 'earned guide reward reports travel restriction honestly');
$db->execute("UPDATE player_travel SET status = 'arrived' WHERE player_id = :id", ['id' => $a]);
$reward = depthAct('mission.claim', 'c5', $a);
depthProof($reward['onboarding']['currentMissionId'] === 't4' && $reward['result']['cashDelta'] === 5000, 'one mission reward advances saved onboarding sequence');
depthProof(depthReject(fn () => depthAct('mission.claim', 'c5', $a)), 'onboarding does not create a second reward path');
depthProof((new ProgressionService($db, $events))->snapshot($a)['onboarding']['currentMissionId'] === 't4', 'saved objective resumes after service restart');
depthProof(depthReject(fn () => depthAct('faction.contribute', '-1', $leader)) && depthReject(fn () => depthAct('faction.contribute', '9999999999999999999', $leader)), 'negative and overflowing contributions cannot mint shared respect');
depthProof(depthReject(fn () => depthAct('faction.contribute', '100', $b)), 'insufficient personal respect leaves family ledger untouched');
// A shared upgrade cannot add a second capacity bonus to a previously bought personal upgrade.
$legacyB = $progress->snapshot($b)['state']; $legacyB['fac']['ups']['nerveMax'] = 1;
$db->execute('UPDATE player_progression SET state_json = :state WHERE player_id = :id', ['state' => json_encode($legacyB, JSON_THROW_ON_ERROR), 'id' => $b]);
$db->execute('UPDATE players SET max_nerve = max_nerve + 5 WHERE id = :id', ['id' => $b]);
depthAct('faction.contribute', '7000', $leader);
depthAct('faction.sharedUpgrade', 'nerveMax', $leader);
depthProof($progress->snapshot($b)['player']['max_nerve'] === 50 && $progress->snapshot($a)['player']['max_nerve'] === 50, 'shared nerve upgrade preserves prior personal bonus without stacking and benefits another member');
$progress->recordMetric($a, 'trains', 4); depthAct('mission.claim', 't4', $a);
$progress->recordMetric($a, 'shifts', 2); depthAct('mission.claim', 's2', $a);
depthAct('item.buy', 'knife', $a); depthAct('mission.claim', 'b1', $a); depthAct('mission.claim', 'w1', $a);
depthProof($progress->snapshot($a)['onboarding']['completed'] && $progress->snapshot($a)['onboarding']['currentMissionId'] === null, 'five objective claims finish the saved guide using existing rewards only');
$persisted = json_decode($db->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => $a])['state_json'], true, 512, JSON_THROW_ON_ERROR);
depthProof($persisted['onboarding']['completed'] && $persisted['onboarding']['completedAt'] > 0, 'completion time and objective cursor are saved with reward settlement');
depthProof((int) $db->fetchOne("SELECT COUNT(*) AS total FROM event_log WHERE event_name = 'OnboardingObjectiveClaimed' AND CAST(payload_json AS TEXT) LIKE :needle", ['needle' => '%' . $a . '%'])['total'] === 5, 'each completed guide objective emits one persistent event');
depthProof($progress->snapshot($b)['state']['ctr']['crimes'] === 0 && $progress->snapshot($b)['player']['cash'] === 2500, 'cooperative respect leaves another account individual progress untouched');
echo 'BETA DEPTH RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;

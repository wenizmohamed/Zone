<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/family-leadership-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback database required.');
}
$engine = zone_engine($url); $db = Database::connect($url);
if (($argv[1] ?? '') === '--join-worker') {
    $joined = $engine->joinFaction((string) getenv('ZONE_FAMILY_TEST_ID'), (string) getenv('ZONE_FAMILY_TEST_PLAYER'));
    echo $joined['map']['playerFactionRole'] . PHP_EOL; exit(0);
}
$count = 0;
function leadershipProof(bool $ok, string $label): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $count++; echo 'PASS: ' . $label . PHP_EOL; }
function leadershipFamily($db): string {
    $id = 'leader-' . bin2hex(random_bytes(6));
    $db->execute('INSERT INTO factions (id, name_en, name_ar, color, enabled) VALUES (:id, :en, :ar, :color, 1)', ['id' => $id, 'en' => 'Isolated leadership family', 'ar' => 'عائلة الاختبار', 'color' => '#445566']);
    return $id;
}
$id = leadershipFamily($db); $workers = [];
for ($i = 0; $i < 3; $i++) {
    $player = $engine->browserSessions()->create('leader-race-' . bin2hex(random_bytes(6)))['playerId'];
    $worker = proc_open([PHP_BINARY, '-d', 'extension=pdo_pgsql', __FILE__, '--join-worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DEPTH_TEST_URL' => $url, 'ZONE_FAMILY_TEST_ID' => $id, 'ZONE_FAMILY_TEST_PLAYER' => $player], ['bypass_shell' => true]);
    if (!is_resource($worker)) throw new RuntimeException('Join worker did not start.'); fclose($pipes[0]); $workers[] = [$worker, $pipes];
}
$roles = [];
foreach ($workers as [$worker, $pipes]) {
    $output = trim(stream_get_contents($pipes[1])); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $code = proc_close($worker);
    if ($code !== 0 || !in_array($output, ['leader', 'member'], true)) throw new RuntimeException('Join worker failed: ' . $output . $error);
    $roles[] = $output;
}
leadershipProof(count(array_filter($roles, fn ($r) => $r === 'leader')) === 1 && count(array_filter($roles, fn ($r) => $r === 'member')) === 2, 'three simultaneous first joins produce exactly one leader and two members');
$leaders = $db->fetchAll("SELECT player_id FROM faction_members WHERE faction_id = :id AND role = 'leader'", ['id' => $id]);
leadershipProof(count($leaders) === 1, 'the elected leader is persisted once in the shared roster');
$late = $engine->browserSessions()->create('leader-late-' . bin2hex(random_bytes(6)))['playerId'];
$joined = $engine->joinFaction($id, $late);
leadershipProof($joined['map']['playerFactionRole'] === 'member' && $db->fetchOne("SELECT player_id FROM faction_members WHERE faction_id = :id AND role = 'leader'", ['id' => $id])['player_id'] === $leaders[0]['player_id'], 'later join cannot replace the existing elected leader');
leadershipProof($engine->gameplay($leaders[0]['player_id'])['family']['permissions']['buyUpgrade'], 'the real first joining player can spend shared upgrade respect');
$orphan = leadershipFamily($db);
$old = $engine->browserSessions()->create('leader-old-' . bin2hex(random_bytes(6)))['playerId'];
$db->execute("INSERT INTO faction_members (player_id, faction_id, role, joined_at) VALUES (:player, :family, 'member', :at)", ['player' => $old, 'family' => $orphan, 'at' => gmdate('c')]);
$visitor = $engine->browserSessions()->create('leader-orphan-' . bin2hex(random_bytes(6)))['playerId'];
$joined = $engine->joinFaction($orphan, $visitor);
leadershipProof($joined['map']['playerFactionRole'] === 'member' && $db->fetchOne('SELECT role FROM faction_members WHERE player_id = :id', ['id' => $old])['role'] === 'member', 'legacy populated family without a leader never silently promotes a new or old member');
leadershipProof($engine->gameplay($visitor)['family']['leadershipMissing'], 'legacy vacant leadership is explicitly reported for owner correction');
leadershipProof($db->fetchOne('SELECT role FROM faction_members WHERE player_id = :id', ['id' => 'founder-player'])['role'] === 'leader', 'existing founder leadership remains unchanged');
echo 'FAMILY LEADERSHIP RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;

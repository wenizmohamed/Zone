<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

// Accept only an in-memory database or a deliberately named loopback fixture.
$url = getenv('ZONE_OWNER_TEST_URL') ?: 'sqlite::memory:';
if ($url !== 'sqlite::memory:') {
    $target = parse_url($url);
    if (!in_array($target['host'] ?? '', ['127.0.0.1', 'localhost'], true)
        || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) throw new RuntimeException('Disposable loopback owner test database required.');
}
$db = Database::connect($url); $db->migrateAndSeed();
function ownerTestEngine(Database $db): \Zone\Engine\Application\GameEngine {
    $events = new \Zone\Engine\Core\Events\EventBus($db);
    $modules = new \Zone\Engine\Core\Modules\ModuleRegistry($db, $events, ZONE_ENGINE_ROOT . '/modules'); $modules->discoverAndBoot();
    $themes = new \Zone\Engine\Core\Themes\ThemeRegistry($db, ZONE_ENGINE_ROOT . '/themes'); $themes->discover();
    return new \Zone\Engine\Application\GameEngine($db, $events, $modules, $themes, new \Zone\Engine\Core\Publishing\ReleaseManager($db, $events), new \Zone\Engine\Infrastructure\Cache\ArrayCacheStore());
}
$engine = ownerTestEngine($db);
if (($argv[1] ?? '') === '--sandbox-race') {
    $result = $engine->ownerPlaytest()->act((string) getenv('ZONE_OWNER_RACE_PLAYER'), 'isolated-owner', [
        'sessionId' => (string) getenv('ZONE_OWNER_RACE_SESSION'), 'idempotencyKey' => (string) getenv('ZONE_OWNER_RACE_KEY'), 'expectedVersion' => (int) getenv('ZONE_OWNER_RACE_VERSION'), 'action' => 'item.equip', 'id' => 'fists']);
    echo hash('sha256', json_encode($result, JSON_THROW_ON_ERROR)) . PHP_EOL; exit(0);
}
$crimeFixture = array_values(array_filter($engine->adminCrimes(), static fn ($crime) => $crime['id'] === 'trash'))[0];
$engine->saveCrime('trash', [...$crimeFixture, 'success_basis_points' => 0], 'isolated-test'); $engine->publishRelease('isolated-test');
$passed = 0;
function ownerProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function ownerReject(callable $fn, string $part = ''): bool { try { $fn(); } catch (RuntimeException|InvalidArgumentException $error) { return str_contains($error->getMessage(), $part); } return false; }
$source = $engine->browserSessions()->create('owner-test-' . bin2hex(random_bytes(6)))['playerId'];
$other = $engine->browserSessions()->create('other-owner-test-' . bin2hex(random_bytes(6)))['playerId'];
$engine->gameplay($source); $engine->gameplay($other);
$before = [];
foreach (['players', 'player_progression', 'browser_sessions', 'player_credentials', 'economy_ledger', 'event_log', 'achievements', 'action_cooldowns', 'action_rate_limits', 'faction_members', 'territory_control', 'jobs', 'notifications'] as $table) $before[$table] = $db->fetchAll('SELECT * FROM ' . $table);
$sandbox = $engine->ownerPlaytest();
ownerProof(!$sandbox->status($source)['active'], 'normal player has no implicit owner playtest entitlement');
$s = $sandbox->start($source, 'isolated-owner', str_repeat('a', 24));
ownerProof($s['active'] && $s['mode'] === 'owner-playtest' && $s['gameplay']['player']['id'] !== $source, 'explicit start returns a separate clearly labeled character');
ownerProof($s === $sandbox->start($source, 'isolated-owner', str_repeat('a', 24)), 'duplicate start returns identical response without duplicate provision');
ownerProof(count($s['gameplay']['state']['inv']) === count($s['gameplay']['catalogs']['items']) && min($s['gameplay']['state']['inv']) === 3, 'every published item is provisioned only in sandbox ownership');
ownerProof($s['gameplay']['player']['level'] >= max(array_column($s['gameplay']['catalogs']['jobs'], 'lvl')) && $s['gameplay']['state']['gymXp'] >= max(array_column($s['gameplay']['catalogs']['gyms'], 'xp')), 'published jobs and gym progression are unlocked in the sandbox');
ownerProof($db->fetchOne('SELECT id FROM players WHERE id = :id', ['id' => $s['gameplay']['player']['id']]) === null, 'temporary character does not survive successful start');
ownerProof(!$sandbox->status($other)['active'], 'another player does not borrow the owner sandbox');
if ($db->driver() === 'pgsql') {
    $workers = []; $raceKey = bin2hex(random_bytes(16));
    for ($i = 0; $i < 3; $i++) {
        $worker = proc_open([PHP_BINARY, '-d', 'extension=pdo_pgsql', __FILE__, '--sandbox-race'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT,
            [...getenv(), 'ZONE_OWNER_RACE_PLAYER' => $source, 'ZONE_OWNER_RACE_SESSION' => $s['sessionId'], 'ZONE_OWNER_RACE_KEY' => $raceKey, 'ZONE_OWNER_RACE_VERSION' => (string) $s['version']], ['bypass_shell' => true]);
        if (!is_resource($worker)) throw new RuntimeException('PostgreSQL owner race worker failed to start.'); fclose($pipes[0]); $workers[] = [$worker, $pipes];
    }
    $hashes = [];
    foreach ($workers as [$worker, $pipes]) {
        $output = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); $code = proc_close($worker);
        if ($code !== 0 || !preg_match('/^[a-f0-9]{64}$/D', trim($output))) throw new RuntimeException('Owner race worker failed: ' . $output . $error);
        $hashes[] = trim($output);
    }
    ownerProof(count(array_unique($hashes)) === 1, 'three concurrent PostgreSQL owner requests return exactly one identical settlement');
    $reloaded = $sandbox->status($source); ownerProof($reloaded['version'] === $s['version'] + 1, 'concurrent owner replay increments sandbox version only once');
    $s = $reloaded;
}
function ownerAct(string $action, array $payload = []): array { global $sandbox, $source, $s; $s = $sandbox->act($source, 'isolated-owner', ['sessionId' => $s['sessionId'], 'idempotencyKey' => bin2hex(random_bytes(16)), 'expectedVersion' => $s['version'], 'action' => $action, ...$payload]); return $s; }
$job = $s['gameplay']['catalogs']['jobs'][array_key_last($s['gameplay']['catalogs']['jobs'])];
ownerAct('job.take', ['id' => $job['id']]);
$cash = $s['gameplay']['player']['cash'];
ownerAct('job.work');
ownerProof($s['result']['jobId'] === $job['id'] && $s['gameplay']['player']['cash'] === $cash + $job['pay'], 'real PHP job choice and wage execute for highest-level job');
ownerProof($s['gameplay']['player']['energy'] === $s['gameplay']['player']['max_energy'] && $s['result']['cost']['energy'] === $job['energy'], 'real action cost is recorded while sandbox resources refill');
ownerAct('job.work');
ownerProof($s['gameplay']['player']['cash'] === $cash + 2 * $job['pay'], 'owner can repeat work without normal player cooldown or depletion');
ownerAct('gym.join', ['id' => (string) array_key_last($s['gameplay']['catalogs']['gyms'])]);
$strength = $s['gameplay']['player']['strength']; ownerAct('gym.train', ['stat' => 'strength', 'sessions' => 2]);
ownerProof($s['gameplay']['player']['strength'] > $strength && $s['result']['sessions'] === 2, 'actual advanced gym training persists sandbox stats');
$cash = $s['gameplay']['player']['cash']; ownerAct('bank.deposit', ['amount' => 125]);
ownerProof($s['gameplay']['player']['cash'] === $cash - 125 && $s['gameplay']['player']['bank_balance'] === 125, 'real bank deposit reconciles sandbox cash and savings');
ownerAct('bank.withdraw', ['amount' => 125]);
ownerProof($s['gameplay']['player']['cash'] === $cash && $s['gameplay']['player']['bank_balance'] === 0, 'real withdrawal returns its exact sandbox balance');
$weapon = array_keys(array_filter($s['gameplay']['catalogs']['items'], static fn ($item) => $item['type'] === 'weapon'))[0];
ownerAct('item.equip', ['id' => $weapon]); ownerProof($s['gameplay']['state']['equip'] === $weapon, 'authoritative item equip works with sandbox-only ownership');
$quantity = $s['gameplay']['state']['inv'][$weapon]; $cash = $s['gameplay']['player']['cash']; $price = $s['gameplay']['catalogs']['items'][$weapon]['price'];
$request = ['sessionId' => $s['sessionId'], 'idempotencyKey' => bin2hex(random_bytes(16)), 'expectedVersion' => $s['version'], 'action' => 'item.buy', 'id' => $weapon];
$s = $sandbox->act($source, 'isolated-owner', $request);
ownerProof($s['gameplay']['state']['inv'][$weapon] === $quantity + 1 && $s['gameplay']['player']['cash'] === $cash - $price, 'published purchase charges real catalog price and issues one sandbox unit');
$audit = count($db->fetchAll('SELECT * FROM admin_audit_log'));
ownerProof($s === $sandbox->act($source, 'isolated-owner', $request) && count($db->fetchAll('SELECT * FROM admin_audit_log')) === $audit, 'idempotent action replay cannot double settle or duplicate owner audit');
ownerProof(ownerReject(fn () => $sandbox->act($source, 'isolated-owner', [...$request, 'id' => 'smallkit']), 'already used'), 'same idempotency key cannot be reassigned');
ownerProof(ownerReject(fn () => $sandbox->act($source, 'isolated-owner', [...$request, 'idempotencyKey' => bin2hex(random_bytes(16))]), 'state changed'), 'stale sandbox version cannot spend twice');
$status = $sandbox->status($source); ownerProof($status['gameplay']['state']['equip'] === $weapon && $status['gameplay']['player']['cash'] === $s['gameplay']['player']['cash'], 'sandbox state persists across new read requests');
$beforeFailure = $sandbox->status($source); ownerProof(ownerReject(fn () => ownerAct('bank.withdraw', ['amount' => 1000000])), 'failed sandbox bank action returns a real insufficiency error');
ownerProof($sandbox->status($source)['version'] === $beforeFailure['version'] && $sandbox->status($source)['gameplay']['player']['cash'] === $beforeFailure['gameplay']['player']['cash'], 'failure commits neither sandbox version nor money');
foreach (['market.player-buy', 'faction.contribute', 'faction.sharedUpgrade', 'territory.assault', 'player-combat.start'] as $action) ownerProof(ownerReject(fn () => ownerAct($action), 'not available'), 'shared mutation fails closed: ' . $action);
ownerProof(ownerReject(fn () => $sandbox->act($source, 'isolated-owner', ['sessionId' => $s['sessionId'], 'action' => 'item.buy', 'id' => $weapon, 'expectedVersion' => $s['version'], 'idempotencyKey' => bin2hex(random_bytes(16)), 'playerId' => $other]), 'Unknown'), 'owner action cannot submit another player ID');
ownerAct('item.use', ['id' => 'smallkit']); ownerProof($s['result']['result']['restored']['life'] > 0 && $s['gameplay']['state']['inv']['smallkit'] === 2, 'real medical consumption has a server restoration result and exact sandbox unit sink');
ownerAct('property.buy', ['id' => $s['gameplay']['catalogs']['properties'][array_key_last($s['gameplay']['catalogs']['properties'])]['id']]); ownerProof($s['result']['result']['action'] === 'property.buy', 'published property purchase runs actual personal progression');
ownerAct('hospital.heal'); ownerProof($s['result']['player']['life'] === $s['result']['player']['max_life'], 'hospital treatment executes its server quote and payment');
ownerAct('course.enroll', ['id' => $s['gameplay']['catalogs']['courses'][0]['id']]);
ownerProof($s['result']['state']['edu']['until'] > time() * 1000 && $s['gameplay']['state']['edu'] === null && !empty($s['gameplay']['state']['eduDone'][$s['gameplay']['catalogs']['courses'][0]['id']]), 'enrollment receipt retains real future timer while sandbox completes the personal course');
ownerAct('travel.start', ['id' => 'Dubai']);
ownerProof($s['result']['travel']['status'] === 'traveling' && $s['result']['travel']['remainingSeconds'] > 0 && $s['gameplay']['travel']['status'] === 'arrived' && $s['gameplay']['player']['city'] === 'Dubai', 'actual travel departure receipt survives owner-only immediate personal arrival');
ownerAct('job.work'); ownerProof($s['result']['shift'] === 'worked', 'owner can continue testing immediately after travel fast-forward');
$metadataKey = 'owner-playtest:' . hash('sha256', $source);
$fixture = json_decode($db->fetchOne('SELECT value FROM engine_metadata WHERE name = :key', ['key' => $metadataKey])['value'], true, 512, JSON_THROW_ON_ERROR);
// Deterministic failure fixture: only the private test snapshot is changed.
$fixture['snapshot']['player']['level'] = 1;
$db->execute('UPDATE engine_metadata SET value = :json WHERE name = :key', ['key' => $metadataKey, 'json' => json_encode($fixture, JSON_THROW_ON_ERROR)]);
ownerAct('crime.attempt', ['id' => 'trash']);
ownerProof(!$s['result']['success'] && $s['result']['penalty']['type'] === 'jail' && $s['gameplay']['state']['jailUntil'] === 0 && in_array('jailUntil', $s['receipt']['testingAdjustments']['penalties'], true), 'failed crime and jail receipt remain truthful while owner-only penalty clears');
ownerProof(in_array('CrimeFailed', array_column($s['receipt']['events'], 'event_name'), true), 'sandbox failed-crime receipt retains actual correlated failure event');
ownerAct('bank.deposit', ['amount' => 1]); ownerProof($s['gameplay']['player']['bank_balance'] === 1, 'owner continues bank testing after actual failed crime');
ownerAct('combat.start', ['opponentId' => $s['gameplay']['catalogs']['opponents'][0]['id']]);
ownerProof($s['combat']['encounter']['phase'] === 'fighting' && $s['combat']['version'] > 1, 'NPC encounter persists only inside sandbox snapshot');
ownerAct('combat.strike'); ownerProof($s['combat']['encounter']['turn'] === 1, 'real NPC strike advances its authoritative sandbox turn');
foreach ($before as $table => $rows) ownerProof($db->fetchAll('SELECT * FROM ' . $table) === $rows, 'normal persistent table unchanged: ' . $table);
ownerProof($db->fetchOne("SELECT id FROM players WHERE id LIKE 'owner-playtest-%'") === null, 'temporary identity never survives success, failure or reads');
ownerProof(count($db->fetchAll("SELECT id FROM admin_audit_log WHERE target_type = 'owner-playtest'")) > 10, 'owner testing is audited separately from live economy');
$endKey = str_repeat('z', 24); $firstSessionId = $s['sessionId']; $ended = $sandbox->end($source, 'isolated-owner', $firstSessionId, $endKey);
ownerProof(!$ended['active'] && $ended['restoredPlayerId'] === $source && !$sandbox->status($source)['active'], 'exit deletes active sandbox state and returns unchanged real identity');
ownerProof($ended === $sandbox->end($source, 'isolated-owner', $firstSessionId, $endKey), 'exit is safely idempotent');
ownerProof(ownerReject(fn () => ownerAct('job.work'), 'not active'), 'ended sandbox cannot execute further actions');
$db->execute("UPDATE cooldown_config SET seconds = 37 WHERE action = 'job'");
$configured = ownerTestEngine($db); $worked = $configured->workShift($source);
$jobCooldown = $worked['cooldowns']['actions']['job'];
ownerProof($jobCooldown['remainingSeconds'] === 37 && $jobCooldown['availableAtEpoch'] === $worked['cooldowns']['serverTimeEpoch'] + 37, 'work response exposes configured37-second expiry from server state');
$reloaded = ownerTestEngine($db)->gameplay($source)['cooldowns']['actions']['job'];
ownerProof($reloaded['availableAtEpoch'] === $jobCooldown['availableAtEpoch'] && $reloaded['remainingSeconds'] > 0, 'job cooldown expiry survives a fresh engine and gameplay reload');
ownerProof(ownerReject(fn () => $configured->workShift($source), 'cooldown'), 'ordinary player still obeys configured job cooldown');
$normalFailure = $configured->attemptCrime('trash', $source);
ownerProof(!$normalFailure['success'] && $configured->gameplay($source)['state']['jailUntil'] > time() * 1000, 'ordinary player crime failure retains its real future jail penalty');
$db->execute('UPDATE players SET cash = 20000 WHERE id = :id', ['id' => $other]);
$normalCourse = $configured->gameplayAction('course.enroll', 'bio', $configured->gameplay($other)['state']['version'], $other);
ownerProof($normalCourse['state']['edu']['until'] > time() * 1000 && empty($configured->gameplay($other)['state']['eduDone']['bio']), 'ordinary education retains its actual future completion timer');
$normalTravel = $configured->travel('Dubai', $other);
ownerProof($normalTravel['travel']['status'] === 'traveling' && $configured->gameplay($other)['travel']['remainingSeconds'] > 0, 'ordinary travel remains pending rather than being fast-forwarded');
$engine->changeModule('kill', 'disable'); $engine->changeModule('blackjack', 'disable'); $engine->publishRelease('isolated-test');
$s = $sandbox->start($source, 'isolated-owner', str_repeat('m', 24));
ownerProof(ownerReject(fn () => $sandbox->act($source, 'isolated-owner', ['sessionId' => $firstSessionId, 'expectedVersion' => 1, 'idempotencyKey' => str_repeat('v', 24), 'action' => 'bank.deposit', 'amount' => 1]), 'Session identity'), 'old-session version1 action cannot enter a new version1 sandbox');
ownerProof(ownerReject(fn () => $sandbox->end($source, 'isolated-owner', $firstSessionId, $endKey), 'Session identity') && $sandbox->status($source)['active'], 'old-session stop replay cannot deactivate the new sandbox');
ownerProof($s['active'] && $s['combat']['available'] === false && $s['highLow']['available'] === false, 'disabled optional combat/casino modules do not break unrelated owner playtesting');
ownerProof(ownerReject(fn () => ownerAct('combat.start', ['opponentId' => 'rookie']), 'disabled'), 'sandbox cannot bypass an explicitly disabled published module');
$expiredFixture = json_decode($db->fetchOne('SELECT value FROM engine_metadata WHERE name = :key', ['key' => $metadataKey])['value'], true, 512, JSON_THROW_ON_ERROR); $expiredFixture['expiresAt'] = time() - 1;
$db->execute('UPDATE engine_metadata SET value = :json WHERE name = :key', ['key' => $metadataKey, 'json' => json_encode($expiredFixture, JSON_THROW_ON_ERROR)]);
ownerProof(!$sandbox->status($source)['active'], 'expired server snapshot reports inactive rather than inventing current gameplay');
$sandbox->end($source, 'isolated-owner', $s['sessionId'], str_repeat('n', 24));
ownerProof(!$sandbox->status($source)['active'], 'explicit exit safely closes the exact known expired session');
ownerProof(ownerReject(fn () => $sandbox->start($source, 'isolated-owner', str_repeat('m', 24)), 'already used'), 'a completed start idempotency key cannot create a new sandbox later');
echo 'OWNER PLAYTEST RESULT: ' . $passed . ' passed, 0 failed; database=' . $db->driver() . PHP_EOL;

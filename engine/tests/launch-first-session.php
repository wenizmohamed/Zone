<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

// Real router, production-mode authorization and two ordinary cookie sessions.
// This intentionally retains published rules, random crime outcomes and real
// cooldowns. It is SQLite integration evidence, not PostgreSQL or browser proof.
$prefix = ZONE_ENGINE_ROOT . '/var/launch-first-session-' . bin2hex(random_bytes(6));
$databaseUrl = 'sqlite:' . $prefix . '.sqlite';
$passed = 0;
$process = null;

function launchProof(bool $condition, string $label): void
{
    global $passed;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
    echo 'PASS: ' . $label . PHP_EOL;
}

function launchRequest(string $base, string $method, string $path, ?array $body = null, string $cookie = '', array $extraHeaders = []): array
{
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close', 'Host: zone.test', 'X-Forwarded-Proto: https', 'Origin: https://zone.test'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => implode("\r\n", [...$headers, ...$extraHeaders]),
        'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR),
        'ignore_errors' => true, 'timeout' => 10,
    ]]);
    $raw = @file_get_contents($base . $path, false, $context);
    $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $raw === false ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}

function launchCookie(array $headers): string
{
    foreach ($headers as $header) {
        if (stripos($header, 'Set-Cookie: zone_player_session=') === 0) return explode(';', substr($header, 12), 2)[0];
    }
    throw new RuntimeException('Player session cookie was not issued.');
}

function launchStart(string $databaseUrl, string $log): array
{
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $environment = [...getenv(),
        'ZONE_DATABASE_URL' => $databaseUrl, 'DATABASE_URL' => '', 'POSTGRES_URL' => '',
        'VERCEL' => '1', 'ZONE_PLAYER_SESSIONS' => '1', 'ZONE_PLAYER_AUTH' => '',
        'ZONE_ADMIN_TOKEN' => bin2hex(random_bytes(32)), 'ZONE_BETA_OWNER_ACCESS' => '0',
        'ZONE_ENGINE_RELAY_KEY' => '', 'ZONE_RATE_LIMIT_MAX' => '120', 'ZONE_RATE_LIMIT_WINDOW' => '10',
    ];
    $process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes,
        ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true]);
    if (!is_resource($process)) throw new RuntimeException('Isolated first-session server did not start.');
    fclose($pipes[0]);
    $base = 'http://' . $address;
    $deadline = microtime(true) + 10;
    do {
        [$status] = launchRequest($base, 'GET', '/api/v1/health');
        if ($status === 200) return [$base, $process];
        usleep(100000);
    } while (microtime(true) < $deadline);
    proc_terminate($process);
    proc_close($process);
    throw new RuntimeException('Isolated first-session server did not become healthy.');
}

function launchState(string $base, string $cookie): array
{
    [$status, $state] = launchRequest($base, 'GET', '/api/v1/gameplay', null, $cookie);
    if ($status !== 200) throw new RuntimeException('Gameplay read failed with HTTP ' . $status);
    return $state;
}

function launchAction(string $base, string $cookie, string $action, string $id): array
{
    $state = launchState($base, $cookie);
    $body = ['action' => $action, 'id' => $id, 'expectedVersion' => $state['state']['version']];
    if ($action === 'market.buy') $body['expectedPrice'] = array_column($state['state']['market'], 'price', 'item')[$id];
    [$status, $result] = launchRequest($base, 'POST', '/api/v1/gameplay/action', $body, $cookie);
    if ($status !== 200) throw new RuntimeException($action . ' failed with HTTP ' . $status . ': ' . ($result['error'] ?? 'no error message'));
    return $result;
}

function launchWaitForCooldown(string $base, string $cookie, string $action): void
{
    $first = launchState($base, $cookie);
    $deadline = microtime(true) + (int) ($first['cooldowns']['actions'][$action]['remainingSeconds'] ?? 0) + 3;
    do {
        $state = launchState($base, $cookie);
        if (($state['cooldowns']['actions'][$action]['remainingSeconds'] ?? 0) === 0) return;
        usleep(100000);
    } while (microtime(true) < $deadline);
    throw new RuntimeException('Server-clock cooldown did not expire: ' . $action);
}

function launchValueState(Database $db, string $playerId): array
{
    return [
        'player' => $db->fetchOne('SELECT cash, bank_balance, xp, strength FROM players WHERE id = :id', ['id' => $playerId]),
        'progression' => $db->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]),
        'ledger' => $db->fetchAll('SELECT asset, amount, balance_after, reason, correlation_id FROM economy_ledger WHERE player_id = :id ORDER BY created_at, id', ['id' => $playerId]),
    ];
}

try {
    [$base, $process] = launchStart($databaseUrl, $prefix . '.log');
    $db = Database::connect($databaseUrl);
    [$status] = launchRequest($base, 'GET', '/api/v1/player');
    launchProof($status === 401, 'anonymous entry cannot borrow founder authority');
    [$statusA, $sessionA, $headersA] = launchRequest($base, 'POST', '/api/v1/auth/session', []);
    [$statusB, $sessionB, $headersB] = launchRequest($base, 'POST', '/api/v1/auth/session', []);
    $cookieA = launchCookie($headersA); $cookieB = launchCookie($headersB);
    $idA = $sessionA['playerId']; $idB = $sessionB['playerId'];
    launchProof($statusA === 201 && $statusB === 201 && $idA !== $idB && $idA !== 'founder-player' && $idB !== 'founder-player', 'two fresh HTTP sessions create separate ordinary characters');
    $initialA = launchState($base, $cookieA); $initialB = launchState($base, $cookieB);
    launchProof($initialA['player']['cash'] === 2500 && $initialA['player']['level'] === 1 && $initialA['onboarding']['currentMissionId'] === 'c5', 'starter money, novice level and next objective come from durable server state');
    launchProof($initialA['family'] === null && $initialA['state']['fac']['respect'] === 0 && $initialA['state']['inv'] === ['smallkit' => 1], 'ordinary entry has no staff grants or fictitious faction progress');
    $untouchedB = launchValueState($db, $idB);
    [$status] = launchRequest($base, 'GET', '/api/v1/admin/draft', null, $cookieA);
    launchProof($status === 401, 'ordinary player cookie cannot read operator drafts');
    [$status] = launchRequest($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => 'ordinary-player-attempt'], $cookieA);
    launchProof($status === 401, 'ordinary player cannot create an Owner Playtest grant');
    [$status] = launchRequest($base, 'POST', '/api/v1/jobs/work', ['playerId' => $idB], $cookieA, ['X-Zone-Player-Id: ' . $idB]);
    launchProof($status === 401 && launchValueState($db, $idB) === $untouchedB, 'cross-account identity header is rejected before another player can be paid');

    [$status, $crime] = launchRequest($base, 'POST', '/api/v1/crimes/searchforcash/attempt', ['success' => true, 'cashReward' => 999999], $cookieA);
    launchProof($status === 200 && $crime['cost']['nerve'] === 2 && $crime['serverProof']['clientSuppliedOutcomeFields'] === 0, 'actual first crime ignores proposed client success and reward');
    launchProof($crime['reward']['cash'] === 0 || ($crime['reward']['cash'] >= 80 && $crime['reward']['cash'] <= 240), 'first crime pays only its published server reward range');
    $afterCrime = launchState($base, $cookieA);
    launchProof($afterCrime['state']['ctr']['crimes'] === ($crime['success'] ? 1 : 0) && $afterCrime['state']['crimeXp'] === ($crime['success'] ? 6 : 1), 'actual outcome advances crime skill and mission progress without fabricated successes');
    launchProof($crime['player']['nerve'] === $initialA['player']['nerve'] - 2, 'first crime spends authoritative nerve');
    [$status, $blockedCrime] = launchRequest($base, 'POST', '/api/v1/crimes/searchforcash/attempt', [], $cookieA);
    launchProof($status === 429 && $blockedCrime['action'] === 'crime', 'double-clicking first crime is blocked by its real persistent cooldown');

    [$status, $training] = launchRequest($base, 'POST', '/api/v1/gym/train', ['stat' => 'strength', 'sessions' => 4], $cookieA);
    launchProof($status === 200 && $training['sessions'] === 4 && $training['cost']['energy'] === 20 && $training['gain'] > 0, 'four actual starter gym sessions spend energy and improve strength');
    $afterTraining = launchState($base, $cookieA);
    launchProof($afterTraining['state']['ctr']['trains'] === 4 && $afterTraining['player']['strength'] === $initialA['player']['strength'] + $training['gain'], 'training gains and earned objective progress are stored together');
    $trainingClaim = launchAction($base, $cookieA, 'mission.claim', 't4');
    launchProof($trainingClaim['result']['cashDelta'] === 3000 && $trainingClaim['state']['claimed']['t4'] === 1 && $trainingClaim['state']['points'] === 3, 'real training unlocks a one-time cash and points reward');
    $claimState = launchValueState($db, $idA);
    $fresh = launchState($base, $cookieA);
    [$status, $duplicate] = launchRequest($base, 'POST', '/api/v1/gameplay/action', ['action' => 'mission.claim', 'id' => 't4', 'expectedVersion' => $fresh['state']['version']], $cookieA);
    launchProof($status === 400 && $duplicate['error'] === 'This mission reward has already been claimed.' && launchValueState($db, $idA) === $claimState, 'fresh-version duplicate objective claim cannot mint cash, points or another ledger row');
    [$status, $unearned] = launchRequest($base, 'POST', '/api/v1/gameplay/action', ['action' => 'mission.claim', 'id' => 'c5', 'expectedVersion' => $fresh['state']['version']], $cookieA);
    launchProof($status === 400 && $unearned['error'] === 'Complete the mission before claiming its reward.', 'first action does not falsely unlock a five-success crime objective');

    launchAction($base, $cookieA, 'job.take', 'grocer');
    [$status, $shift1] = launchRequest($base, 'POST', '/api/v1/jobs/work', [], $cookieA);
    launchProof($status === 200 && $shift1['jobId'] === 'grocer' && $shift1['reward']['cash'] === 850 && $shift1['cost']['energy'] === 15, 'selected starter job pays its real wage and energy cost');
    [$status] = launchRequest($base, 'POST', '/api/v1/jobs/work', [], $cookieA);
    launchProof($status === 429, 'job double-click cannot duplicate a wage');
    launchWaitForCooldown($base, $cookieA, 'job');
    [$status, $shift2] = launchRequest($base, 'POST', '/api/v1/jobs/work', [], $cookieA);
    launchProof($status === 200 && launchState($base, $cookieA)['state']['ctr']['shifts'] === 2, 'second shift becomes available after the actual server cooldown and persists');
    $jobClaim = launchAction($base, $cookieA, 'mission.claim', 's2');
    launchProof($jobClaim['result']['cashDelta'] === 2500 && $jobClaim['state']['claimed']['s2'] === 1, 'actual work completes the two-shift reward');

    $purchase = launchAction($base, $cookieA, 'market.buy', 'drink');
    launchProof($purchase['result']['cashDelta'] === -990 && $purchase['state']['inv']['drink'] === 1, 'normal market purchase settles the displayed price and one owned item');
    $used = launchAction($base, $cookieA, 'item.use', 'drink');
    launchProof($used['state']['inv']['drink'] === 0 && $used['result']['restored']['nerve'] > 0 && $used['result']['restored']['nerve'] <= 4 && $used['player']['nerve'] <= $used['player']['max_nerve'], 'using the acquired item spends exactly one unit and restores capped nerve');
    $buyClaim = launchAction($base, $cookieA, 'mission.claim', 'b1');
    launchProof($buyClaim['state']['claimed']['b1'] === 1 && $buyClaim['result']['cashDelta'] === 2000, 'acquisition unlocks a real purchase-objective reward');
    launchAction($base, $cookieA, 'item.buy', 'bat');
    $equipped = launchAction($base, $cookieA, 'item.equip', 'bat');
    launchProof($equipped['state']['equip'] === 'bat' && $equipped['state']['inv']['bat'] === 1, 'first equipment decision uses an actually bought weapon');

    $saved = launchState($base, $cookieA);
    $ledger = launchValueState($db, $idA)['ledger'];
    $cashTotal = array_sum(array_column(array_filter($ledger, static fn (array $row): bool => $row['asset'] === 'cash'), 'amount'));
    launchProof($cashTotal === $saved['player']['cash'], 'all starter, streak, crime, job, purchase and mission cash reconciles to the wallet');
    foreach ($saved['state']['inv'] as $itemId => $quantity) {
        $units = array_sum(array_column(array_filter($ledger, static fn (array $row): bool => $row['asset'] === 'item:' . $itemId), 'amount'));
        launchProof($units === $quantity, 'inventory provenance reconciles exactly for ' . $itemId);
    }
    foreach ([$crime['serverProof'], $training['serverProof'], $shift1['serverProof'], $shift2['serverProof']] as $proof) {
        $event = $db->fetchOne('SELECT payload_json FROM event_log WHERE id = :id', ['id' => $proof['eventId']]);
        $payload = json_decode($event['payload_json'] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
        launchProof(($payload['playerId'] ?? null) === $idA && ($payload['correlationId'] ?? null) === $proof['correlationId'], 'actual action persists its own player and correlation in the event log');
    }
    launchProof(launchValueState($db, $idB) === $untouchedB, 'entire first session leaves the second account wallet, inventory, progression and ledger untouched');
    $persisted = launchValueState($db, $idA);
    $credentials = ['username' => 'LaunchKeeper', 'password' => 'isolated launch regression password'];
    [$status, $claim, $headers] = launchRequest($base, 'POST', '/api/v1/auth/claim', $credentials, $cookieA);
    $claimedCookie = launchCookie($headers);
    launchProof($status === 200 && $claim['playerId'] === $idA && launchValueState($db, $idA) === $persisted, 'permanent account claim preserves the entire earned first session');
    [$status] = launchRequest($base, 'GET', '/api/v1/gameplay', null, $cookieA);
    launchProof($status === 401, 'pre-claim guest cookie cannot replay authority after account rotation');
    proc_terminate($process); proc_close($process); $process = null;
    [$base, $process] = launchStart($databaseUrl, $prefix . '.log');
    $resumed = launchState($base, $claimedCookie);
    launchProof(launchValueState($db, $idA) === $persisted && $resumed['onboarding'] === $saved['onboarding'] && $resumed['state']['equip'] === 'bat', 'backend restart resumes balances, ownership, equipment and onboarding without reissuing grants');
    [$status, $login, $headers] = launchRequest($base, 'POST', '/api/v1/auth/login', $credentials);
    $returnCookie = launchCookie($headers);
    $returned = launchState($base, $returnCookie);
    launchProof($status === 200 && $login['playerId'] === $idA && $returned['player']['id'] === $idA && launchValueState($db, $idA) === $persisted, 'cookie-free return login restores the played character rather than a fresh guest');
    launchProof(launchState($base, $cookieB)['player']['id'] === $idB && launchValueState($db, $idB) === $untouchedB, 'second ordinary session also survives backend restart unchanged');
    $returnedGuide = $returned['onboarding'];
    launchProof($returnedGuide['currentMissionId'] === 'c5' && !$returnedGuide['completed'] && $returned['state']['claimed'] === ['t4' => 1, 's2' => 1, 'b1' => 1], 'onboarding honestly resumes unearned goals while retaining real completed rewards');
    $final = launchState($base, $returnCookie);
    [$status, $duplicate] = launchRequest($base, 'POST', '/api/v1/gameplay/action', ['action' => 'mission.claim', 'id' => 't4', 'expectedVersion' => $final['state']['version']], $returnCookie);
    launchProof($status === 400 && $duplicate['error'] === 'This mission reward has already been claimed.' && launchValueState($db, $idA) === $persisted, 'reward replay remains rejected across process restart and return login');
    $claims = [];
    foreach ($db->fetchAll("SELECT payload_json FROM event_log WHERE event_name = 'OnboardingObjectiveClaimed'") as $event) {
        $payload = json_decode($event['payload_json'], true, 512, JSON_THROW_ON_ERROR);
        if (($payload['playerId'] ?? null) === $idA) $claims[] = $payload;
    }
    $claimedMissionIds = array_column($claims, 'missionId');
    sort($claimedMissionIds);
    launchProof($claimedMissionIds === ['b1', 's2', 't4'] && count(array_unique(array_column($claims, 'correlationId'))) === 3, 'earned objectives publish exactly three distinct claim events, never replayed rewards');
    foreach ($claims as $claimEvent) {
        $matchingCash = array_values(array_filter($ledger, static fn (array $entry): bool => $entry['asset'] === 'cash' && $entry['reason'] === 'mission.claim' && $entry['correlation_id'] === $claimEvent['correlationId']));
        launchProof(count($matchingCash) === 1 && (int) $matchingCash[0]['amount'] > 0, 'objective event and one durable reward share the same correlation');
    }
    echo 'FIRST SESSION EVIDENCE: ' . json_encode([
        'adapter' => 'sqlite', 'ordinaryPlayers' => 2, 'serverRestarts' => 1,
        'crimeSuccess' => $crime['success'], 'crimeCash' => $crime['reward']['cash'],
        'trainingGain' => $training['gain'], 'shifts' => 2,
        'cash' => $returned['player']['cash'], 'energy' => $returned['player']['energy'],
        'nerve' => $returned['player']['nerve'], 'inventory' => $returned['state']['inv'],
        'claimedObjectives' => array_keys($returned['state']['claimed']),
        'onboardingComplete' => false, 'fixturesOrStaffGrants' => false,
        'database' => $prefix . '.sqlite', 'serverLog' => $prefix . '.log',
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    echo "LAUNCH FIRST SESSION RESULT: {$passed} passed, 0 failed\n";
} finally {
    if (is_resource($process)) { proc_terminate($process); proc_close($process); }
}

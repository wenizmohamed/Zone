<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

// Real HTTP/router and ordinary cookies. No grants, edited rules or fake rolls.
// SQL below only reads this test's own disposable SQLite evidence. No live DB.
$prefix = ZONE_ENGINE_ROOT . '/var/launch-crimes-' . bin2hex(random_bytes(8));
$databaseUrl = 'sqlite:' . $prefix . '.sqlite';
$process = null;
$passed = 0;
$started = microtime(true);
if (!is_dir(ZONE_ENGINE_ROOT . '/var') && !mkdir(ZONE_ENGINE_ROOT . '/var', 0700, true) && !is_dir(ZONE_ENGINE_ROOT . '/var')) {
    throw new RuntimeException('Cannot create this checkout\'s isolated test evidence directory.');
}

function crimeProof(bool $ok, string $label): void
{
    global $passed;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
    echo 'PASS: ' . $label . PHP_EOL;
}

function crimeHttp(string $base, string $method, string $path, ?array $body = null, string $cookie = ''): array
{
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close',
        'Host: zone.test', 'Origin: https://zone.test', 'X-Forwarded-Proto: https'];
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers),
        'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true,
        'timeout' => 4, 'follow_location' => 0, 'max_redirects' => 0]]);
    $raw = @file_get_contents($base . $path, false, $context);
    $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $raw === false ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}

function crimeCookie(array $headers): string
{
    foreach ($headers as $header) if (stripos($header, 'Set-Cookie: zone_player_session=') === 0) {
        return explode(';', substr($header, 12), 2)[0];
    }
    throw new RuntimeException('Ordinary player cookie missing.');
}

function crimeStart(string $databaseUrl, string $log): array
{
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false); fclose($socket);
    $environment = [...getenv(), 'ZONE_DATABASE_URL' => $databaseUrl, 'DATABASE_URL' => '', 'POSTGRES_URL' => '',
        'VERCEL' => '1', 'ZONE_PLAYER_SESSIONS' => '1', 'ZONE_PLAYER_AUTH' => '', 'ZONE_REDIS_URL' => '',
        'ZONE_ADMIN_TOKEN' => bin2hex(random_bytes(32)), 'ZONE_ADMIN_USERNAME' => '', 'ZONE_ADMIN_PASSWORD_HASH' => '',
        'ZONE_ADMIN_SESSION_SECRET' => '', 'ZONE_BETA_OWNER_ACCESS' => '0', 'ZONE_ENGINE_RELAY_KEY' => '',
        'ZONE_ENGINE_ORIGIN' => '', 'ZONE_DEPTH_TEST_URL' => ''];
    $process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes,
        ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true]);
    if (!is_resource($process)) throw new RuntimeException('Isolated Crimes server did not start.');
    fclose($pipes[0]); $base = 'http://' . $address; $deadline = microtime(true) + 5;
    do {
        [$status] = crimeHttp($base, 'GET', '/api/v1/health');
        if ($status === 200) return [$base, $process];
        usleep(100000);
    } while (microtime(true) < $deadline && proc_get_status($process)['running']);
    proc_terminate($process); proc_close($process);
    throw new RuntimeException('Isolated Crimes server never became healthy. Log: ' . $log);
}

function crimeState(string $base, string $cookie): array
{
    [$status, $state] = crimeHttp($base, 'GET', '/api/v1/gameplay', null, $cookie);
    if ($status !== 200) throw new RuntimeException('Saved Crimes state unavailable, HTTP ' . $status);
    return $state;
}

function crimeStored(Database $db, string $id): array
{
    return [
        'player' => $db->fetchOne('SELECT cash, bank_balance, xp, level, nerve, energy, life FROM players WHERE id=:id', ['id' => $id]),
        'progression' => $db->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id=:id', ['id' => $id]),
        'ledger' => $db->fetchAll('SELECT id, asset, amount, balance_after, reason, correlation_id FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $id]),
    ];
}

try {
    [$base, $process] = crimeStart($databaseUrl, $prefix . '.log');
    $db = Database::connect($databaseUrl);
    [$status] = crimeHttp($base, 'GET', '/api/v1/player');
    crimeProof($status === 401, 'anonymous entry cannot inherit founder identity');
    [$status, $bootstrap] = crimeHttp($base, 'GET', '/api/v1/game/bootstrap');
    crimeProof($status === 200 && is_array($bootstrap['content']['crimes'] ?? null), 'actual public bootstrap supplies published crime definitions');
    $trash = array_values(array_filter($bootstrap['content']['crimes'], static fn (array $crime): bool => $crime['id'] === 'trash'))[0] ?? null;
    crimeProof(is_array($trash) && $trash['enabled'] === true, 'actual published trash opportunity exists and is enabled');
    crimeProof($trash['nerve_cost'] > 0 && $trash['cash_min'] >= 0 && $trash['cash_max'] >= $trash['cash_min'], 'displayed nerve cost and cash range are real published rules');
    crimeProof($trash['level_required'] === 1 && $trash['crime_xp_required'] === 0 && $trash['category'] === 'search', 'published trash gates are eligible for a novice ordinary player');
    crimeProof($trash['success_basis_points'] > 0 && $trash['success_basis_points'] <= 10000 && in_array($trash['failure'], ['jail', 'hosp', 'none'], true), 'risk estimate and failure rule come from bootstrap, not invented client percentages');
    crimeProof($trash['name_en'] !== '' && $trash['name_ar'] !== '' && $trash['name_en'] !== $trash['name_ar'], 'activity identity is genuinely bilingual');
    [$statusA, $sessionA, $headersA] = crimeHttp($base, 'POST', '/api/v1/auth/session', []);
    [$statusB, $sessionB, $headersB] = crimeHttp($base, 'POST', '/api/v1/auth/session', []);
    $cookieA = crimeCookie($headersA); $cookieB = crimeCookie($headersB);
    $idA = $sessionA['playerId']; $idB = $sessionB['playerId'];
    crimeProof($statusA === 201 && $statusB === 201 && $idA !== $idB && $idA !== 'founder-player' && $idB !== 'founder-player', 'two different cookies create two ordinary players');
    $before = crimeState($base, $cookieA); crimeState($base, $cookieB);
    $otherBefore = crimeStored($db, $idB);
    $goal = array_values(array_filter($before['onboarding']['steps'], static fn (array $step): bool => $step['missionId'] === 'c5'))[0];
    crimeProof($before['player']['level'] === 1 && $before['player']['cash'] === 2500 && $goal['progress'] === 0 && $goal['target'] === 5 && !$goal['claimable'], 'new ordinary player begins with actual novice wallet and unearned 0/5 crime objective');
    crimeProof($before['state']['inv'] === ['smallkit' => 1] && $before['state']['crimeXp'] === 0 && $before['family'] === null, 'fresh session has no weapon, XP, faction or staff grants');
    [$status] = crimeHttp($base, 'GET', '/api/v1/admin/draft', null, $cookieA);
    crimeProof($status === 401, 'ordinary cookie has no owner draft authority');
    [$status] = crimeHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => 'crimes-no-owner-grant'], $cookieA);
    crimeProof($status === 401, 'ordinary cookie cannot obtain an owner playtest grant');
    [$status, $attempt] = crimeHttp($base, 'POST', '/api/v1/crimes/trash/attempt', ['success' => true, 'cashReward' => 999999, 'playerId' => $idB], $cookieA);
    crimeProof($status === 200 && is_bool($attempt['success']), 'real server resolves the published trash attempt with genuine randomness');
    // Send immediately, before account work, while the actual cooldown is live.
    [$repeatStatus, $repeat] = crimeHttp($base, 'POST', '/api/v1/crimes/trash/attempt', [], $cookieA);
    crimeProof($repeatStatus === 429 && $repeat['action'] === 'crime', 'immediate duplicate is rejected by the real saved crime cooldown');
    crimeProof($attempt['serverProof']['clientSuppliedOutcomeFields'] === 0 && $attempt['player']['id'] === $idA, 'proposed success/cash and another player ID cannot choose outcome or actor');
    $success = $attempt['success']; $reward = $attempt['reward'];
    crimeProof($attempt['cost']['nerve'] === $trash['nerve_cost'] && $attempt['player']['nerve'] === $before['player']['nerve'] - $trash['nerve_cost'], 'authoritative nerve is spent exactly once on either random outcome');
    crimeProof($success ? $reward['cash'] >= $trash['cash_min'] && $reward['cash'] <= $trash['cash_max'] : $reward['cash'] === 0, 'cash reward matches published success range or zero on failure');
    crimeProof($reward['xp'] === ($success ? $trash['xp_reward'] : 0), 'XP reward matches the actual result without a fake failure reward');
    crimeProof($attempt['player']['cash'] === $before['player']['cash'] + $reward['cash'] + ($attempt['streak']['rewardCash'] ?? 0), 'wallet includes only server crime and disclosed login-streak rewards');
    $after = crimeState($base, $cookieA);
    crimeProof($after['player'] === $attempt['player'], 'fresh HTTP reload matches authoritative receipt resources');
    crimeProof($after['state']['ctr']['crimes'] === ($success ? 1 : 0) && $after['state']['crimeXp'] === ($success ? $trash['xp_reward'] : 1), 'saved counters and crime XP follow actual success or failure rules');
    crimeProof(($after['state']['skill']['trash'] ?? 0) === ($success ? 1 : 0), 'only a real successful trash attempt improves its skill');
    $afterGoal = array_values(array_filter($after['onboarding']['steps'], static fn (array $step): bool => $step['missionId'] === 'c5'))[0];
    crimeProof($afterGoal['progress'] === ($success ? 1 : 0) && $afterGoal['target'] === 5 && !$afterGoal['claimable'] && $after['onboarding']['currentMissionId'] === 'c5', 'objective is honestly 1/5 or 0/5, never a fabricated complete first session');
    if ($success) {
        crimeProof($attempt['penalty'] === null && $after['state']['jailUntil'] === 0 && $after['state']['hospUntil'] === 0, 'successful action does not invent recovery penalties');
    } else {
        crimeProof($attempt['penalty']['type'] === $trash['failure'] && $attempt['penalty']['minutes'] === $trash['penalty_minutes'], 'failed action reports exactly its published penalty');
        $until = (int) $after['state'][$trash['failure'] . 'Until'];
        crimeProof($until > (int) (microtime(true) * 1000) && $until <= (int) (microtime(true) * 1000) + $trash['penalty_minutes'] * 60000 + 1000, 'actual failure creates a saved recovery expiry instead of clearing it locally');
    }
    crimeProof(($after['cooldowns']['actions']['crime']['availableAtEpoch'] ?? 0) > 0, 'cooldown expiry is present in the actual saved gameplay snapshot');
    $event = $db->fetchOne('SELECT event_name, payload_json FROM event_log WHERE id=:id', ['id' => $attempt['serverProof']['eventId']]);
    $payload = json_decode($event['payload_json'], true, 64, JSON_THROW_ON_ERROR);
    crimeProof($event['event_name'] === ($success ? 'CrimeSucceeded' : 'CrimeFailed') && $payload['playerId'] === $idA && $payload['crimeId'] === 'trash' && $payload['correlationId'] === $attempt['serverProof']['correlationId'], 'actual stored event proves actor, crime, outcome and receipt correlation');
    crimeProof(($payload['roll'] <= $payload['successThreshold']) === $success && $payload['cashReward'] === $reward['cash'] && $payload['nerveSpent'] === $trash['nerve_cost'], 'server roll, threshold and saved resource event agree with HTTP result');
    $stored = crimeStored($db, $idA);
    $crimeCash = array_values(array_filter($stored['ledger'], static fn (array $row): bool => $row['reason'] === 'crime.reward' && $row['correlation_id'] === $attempt['serverProof']['correlationId']));
    crimeProof(count($crimeCash) === ($reward['cash'] > 0 ? 1 : 0) && (!$crimeCash || $crimeCash[0]['amount'] === $reward['cash']), 'one success reward ledger entry or no failure reward entry, never a duplicate cash grant');
    $cashSum = array_sum(array_column(array_filter($stored['ledger'], static fn (array $row): bool => $row['asset'] === 'cash'), 'amount'));
    crimeProof($cashSum === $after['player']['cash'], 'starter, streak and crime ledger reconcile exactly to the wallet');
    crimeProof(crimeStored($db, $idB) === $otherBefore, 'second ordinary player remains byte-identical in resources, progression and ledger');
    [$status] = crimeHttp($base, 'POST', '/api/v1/gameplay/action', ['action' => 'mission.claim', 'id' => 'c5', 'expectedVersion' => $after['state']['version']], $cookieA);
    crimeProof($status === 400 && crimeStored($db, $idA) === $stored, 'unearned five-success reward cannot mint cash, points or ledger history');
    $credentials = ['username' => 'CrimeKeeper_' . bin2hex(random_bytes(4)), 'password' => bin2hex(random_bytes(20))];
    [$status, $claimed, $headers] = crimeHttp($base, 'POST', '/api/v1/auth/claim', $credentials, $cookieA);
    $claimedCookie = crimeCookie($headers);
    crimeProof($status === 200 && $claimed['playerId'] === $idA && crimeStored($db, $idA) === $stored, 'ordinary permanent account claim preserves earned crime state and all ledger rows');
    [$status] = crimeHttp($base, 'GET', '/api/v1/gameplay', null, $cookieA);
    crimeProof($status === 401, 'rotated guest cookie cannot retain authority');
    // Stop only this proc_open handle. Never enumerate or terminate live PHP.
    proc_terminate($process); proc_close($process); $process = null;
    [$base, $process] = crimeStart($databaseUrl, $prefix . '.log');
    $resumed = crimeState($base, $claimedCookie);
    crimeProof($resumed['player']['id'] === $idA && $resumed['onboarding'] === $after['onboarding'] && crimeStored($db, $idA) === $stored, 'owned isolated process restart retains cookie, objective, resources and ledger');
    [$status, $login, $headers] = crimeHttp($base, 'POST', '/api/v1/auth/login', $credentials);
    $returnCookie = crimeCookie($headers); $returned = crimeState($base, $returnCookie);
    crimeProof($status === 200 && $login['playerId'] === $idA && $returned['player']['id'] === $idA && crimeStored($db, $idA) === $stored, 'cookie-free return login restores the played character, not a new guest');
    crimeProof(crimeState($base, $cookieB)['player']['id'] === $idB && crimeStored($db, $idB) === $otherBefore, 'second untouched cookie survives restart without receiving another player rewards');
    echo 'CRIMES HTTP EVIDENCE: ' . json_encode(['adapter' => 'sqlite', 'ordinaryPlayers' => 2, 'serverRestarts' => 1,
        'crimeId' => 'trash', 'success' => $success, 'nerveCost' => $trash['nerve_cost'], 'reward' => $reward,
        'goalProgress' => $afterGoal['progress'] . '/' . $afterGoal['target'], 'fixturesOrStaffGrants' => false,
        'elapsedSeconds' => round(microtime(true) - $started, 3), 'database' => $prefix . '.sqlite', 'serverLog' => $prefix . '.log'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    echo "LAUNCH CRIMES HTTP RESULT: {$passed} passed, 0 failed\n";
} finally {
    if (is_resource($process)) { proc_terminate($process); proc_close($process); }
}

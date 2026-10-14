<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

$passed = 0;
function accessProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function accessRequest(string $base, string $method, string $path, ?array $body = null, string $cookie = '', string $origin = 'https://zone.test', array $extra = []): array {
    $headers = ['Accept: application/json', 'Content-Type: application/json', 'Connection: close', 'Host: zone.test', 'X-Forwarded-Proto: https'];
    if ($origin !== '') $headers[] = 'Origin: ' . $origin;
    if ($cookie !== '') $headers[] = 'Cookie: ' . $cookie;
    foreach ($extra as $header) $headers[] = $header;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 10]]);
    $raw = @file_get_contents($base . $path, false, $context);
    $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $raw === false ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}
function accessCookie(array $headers): string {
    foreach ($headers as $header) if (stripos($header, 'Set-Cookie: ') === 0) return explode(';', substr($header, 12), 2)[0];
    throw new RuntimeException('Expected session cookie missing.');
}
function accessServer(string $secret): array {
    $prefix = ZONE_ENGINE_ROOT . '/var/access-http-' . bin2hex(random_bytes(6));
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if (!$socket) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false); fclose($socket);
    $environment = [...getenv(), 'ZONE_DATABASE_URL' => 'sqlite:' . $prefix . '.sqlite', 'DATABASE_URL' => '', 'POSTGRES_URL' => '', 'VERCEL' => '1', 'ZONE_ADMIN_TOKEN' => $secret, 'ZONE_PLAYER_AUTH' => '', 'ZONE_PLAYER_SESSIONS' => '1'];
    $process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $prefix . '.log', 'a'], 2 => ['file', $prefix . '.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true]);
    if (!is_resource($process)) throw new RuntimeException('Isolated access server did not start.');
    fclose($pipes[0]); $base = 'http://' . $address;
    for ($attempt = 0; $attempt < 50; $attempt++) { [$status] = accessRequest($base, 'GET', '/api/v1/health'); if ($status === 200) return [$base, $process]; usleep(100000); }
    proc_terminate($process); proc_close($process); throw new RuntimeException('Isolated access server did not become healthy.');
}
[$base, $process] = accessServer('isolated-owner-test-key');
try {
    foreach (['/api/v1/admin/draft', '/api/v1/admin/gameplay-catalog', '/api/v1/admin/territories', '/api/v1/ledger', '/api/v1/events', '/engine'] as $path) {
        [$status] = accessRequest($base, 'GET', $path); accessProof($status === 401, 'anonymous owner data fails closed: ' . $path);
    }
    [$status, $access] = accessRequest($base, 'GET', '/api/v1/admin/session');
    accessProof($status === 200 && $access['configured'] && !$access['authenticated'] && !$access['localDevelopment'], 'production access status never grants a localhost shortcut');
    [$status] = accessRequest($base, 'POST', '/api/v1/admin/session', ['token' => 'wrong']); accessProof($status === 401, 'wrong owner token is rejected');
    [$status] = accessRequest($base, 'POST', '/api/v1/admin/session', ['token' => 'isolated-owner-test-key'], '', 'https://evil.test'); accessProof($status === 401, 'owner login rejects cross-origin submissions');
    [$status, $access, $headers] = accessRequest($base, 'POST', '/api/v1/admin/session', ['token' => 'isolated-owner-test-key']);
    $owner = accessCookie($headers);
    accessProof($status === 200 && $access['authenticated'] && !str_contains($owner, 'isolated-owner-test-key') && !isset($access['token']), 'owner login returns a signed session rather than exposing its secret');
    $cookieHeader = implode(' ', $headers);
    accessProof(str_contains($cookieHeader, 'HttpOnly') && str_contains($cookieHeader, 'secure') && str_contains($cookieHeader, 'SameSite=Strict'), 'production owner cookie is Secure, HttpOnly and same-site strict');
    [$status, $territories] = accessRequest($base, 'GET', '/api/v1/admin/territories', null, $owner);
    accessProof($status === 200 && count($territories['blocks']) === 120, 'owner territory administration works without creating a player');
    [$status] = accessRequest($base, 'GET', '/api/v1/player'); accessProof($status === 401, 'a fresh visitor cannot read or play as the founder');
    [$status] = accessRequest($base, 'GET', '/api/v1/leaderboards'); accessProof($status === 401, 'standings require a real player session');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/session', [], '', 'https://evil.test'); accessProof($status === 403, 'account creation rejects cross-origin submissions');
    [$status, $first, $headers] = accessRequest($base, 'POST', '/api/v1/auth/session', []); $a = accessCookie($headers);
    accessProof($status === 201 && $first['playerId'] !== 'founder-player' && !isset($first['token']), 'passwordless visit creates a distinct account without exposing its bearer token');
    accessProof(str_contains(implode(' ', $headers), 'HttpOnly') && str_contains(implode(' ', $headers), 'secure'), 'player cookie cannot be read by JavaScript and uses secure transport');
    [$status, $again] = accessRequest($base, 'POST', '/api/v1/auth/session', [], $a);
    accessProof($status === 200 && $again['playerId'] === $first['playerId'], 'reload resolves the same persisted browser account');
    [$status, $second, $headers] = accessRequest($base, 'POST', '/api/v1/auth/session', []); $b = accessCookie($headers);
    accessProof($status === 201 && $second['playerId'] !== $first['playerId'], 'a second browser receives an independent account');
    [$status, $player] = accessRequest($base, 'GET', '/api/v1/player', null, $a);
    accessProof($status === 200 && $player['player']['cash'] === 2500 && $player['player']['id'] === $first['playerId'], 'new player receives the real starting grant and authoritative identity');
    [$status] = accessRequest($base, 'GET', '/api/v1/player', null, $a, 'https://zone.test', ['X-Zone-Player-Id: ' . $second['playerId']]); accessProof($status === 401, 'spoofed player header cannot assume another browser identity');
    [$status] = accessRequest($base, 'POST', '/api/v1/bank/deposit', ['amount' => 100], $a, 'https://evil.test'); accessProof($status === 403, 'player cash mutations reject cross-origin requests');
    [$status] = accessRequest($base, 'POST', '/api/v1/bank/deposit', ['amount' => 100], $a, ''); accessProof($status === 401, 'cookie-authorized mutations require an Origin header');
    [$status] = accessRequest($base, 'POST', '/api/v1/bank/deposit', ['amount' => 100], $a); accessProof($status === 200, 'a valid browser session performs a real bank deposit');
    [, $firstPlayer] = accessRequest($base, 'GET', '/api/v1/player', null, $a); [, $secondPlayer] = accessRequest($base, 'GET', '/api/v1/player', null, $b);
    accessProof($firstPlayer['player']['cash'] === 2400 && $secondPlayer['player']['cash'] === 2500, 'cash debit is persisted only to the acting browser account');
    [$status] = accessRequest($base, 'POST', '/api/v1/factions/join', ['factionId' => 'vipers', 'role' => 'owner'], $a); accessProof($status === 422, 'family join rejects client-supplied owner privileges');
    [$status] = accessRequest($base, 'POST', '/api/v1/factions/join', ['factionId' => 'missing'], $a); accessProof($status === 422, 'unknown family cannot be joined');
    [$status, $joined] = accessRequest($base, 'POST', '/api/v1/factions/join', ['factionId' => 'vipers'], $a);
    accessProof($status === 201 && $joined['map']['playerFactionId'] === 'vipers' && $joined['map']['playerFactionRole'] === 'member', 'a new browser can join a real family as an ordinary member');
    [$status, $map] = accessRequest($base, 'GET', '/api/v1/city/map', null, $a);
    accessProof($status === 200 && $map['playerFactionId'] === 'vipers' && in_array($firstPlayer['player']['username'], array_column($map['members'], 'username'), true), 'family selection and actual member roster persist across reads');
    [$status, $guide] = accessRequest($base, 'GET', '/api/v1/gameplay', null, $a);
    accessProof($status === 200 && $guide['family']['id'] === 'vipers' && !$guide['family']['permissions']['buyUpgrade'] && $guide['onboarding']['currentMissionId'] === 'c5', 'real gameplay route returns shared account permissions and saved next objective');
    [$status] = accessRequest($base, 'POST', '/api/v1/gameplay/action', ['action' => 'faction.sharedUpgrade', 'id' => 'gymBoost', 'expectedVersion' => $guide['state']['version'], 'expectedPrice' => $guide['family']['version']], $a);
    accessProof($status === 400, 'direct HTTP shared upgrade cannot bypass ordinary membership permission');
    [$status] = accessRequest($base, 'POST', '/api/v1/gameplay/action', ['action' => 'faction.contribute', 'id' => '100', 'expectedVersion' => $guide['state']['version'], 'expectedPrice' => $guide['family']['version']], $a);
    accessProof($status === 400, 'direct HTTP contribution cannot spend unearned personal respect');
    [$status] = accessRequest($base, 'POST', '/api/v1/factions/join', ['factionId' => 'kings'], $a); accessProof($status === 400, 'membership cannot be swapped to bypass territory and bonus rules');
    [, $otherMap] = accessRequest($base, 'GET', '/api/v1/city/map', null, $b); accessProof($otherMap['playerFactionId'] === null && $otherMap['members'] === [], 'joining a family never enrolls another player');
    [$status, $standings] = accessRequest($base, 'GET', '/api/v1/leaderboards', null, $a);
    $ownRows = array_values(array_filter($standings['rows'] ?? [], fn ($row) => $row['isCurrentPlayer']));
    accessProof($status === 200 && count($ownRows) === 1 && $ownRows[0]['username'] === $firstPlayer['player']['username'] && $ownRows[0]['family']['id'] === 'vipers', 'real leaderboard shows the acting account and saved family membership');
    accessProof($ownRows[0]['totalStats'] === 40 && $ownRows[0]['liquidFunds'] === 2500 && !isset($ownRows[0]['token_hash'], $ownRows[0]['state_json'], $ownRows[0]['id']), 'leaderboard exposes bounded public stats and real cash plus bank, never private account blobs');
    [$status, $account] = accessRequest($base, 'GET', '/api/v1/auth/account', null, $a);
    accessProof($status === 200 && !$account['claimed'] && $account['playerId'] === $first['playerId'], 'account status resolves the existing guest without a new starting grant');
    $credentials = ['username' => 'BetaHttpKeeper', 'password' => 'long isolated HTTP password'];
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/claim', $credentials, $a, 'https://evil.test'); accessProof($status === 403, 'character claim rejects cross-origin submissions');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/claim', $credentials); accessProof($status === 401, 'anonymous request cannot claim a character');
    [$status, $claim, $headers] = accessRequest($base, 'POST', '/api/v1/auth/claim', $credentials, $a); $claimedCookie = accessCookie($headers);
    accessProof($status === 200 && $claim['playerId'] === $first['playerId'] && !isset($claim['token']) && strlen($claim['recoveryCode']) === 64, 'HTTP claim returns its one-time recovery code but never the session bearer');
    accessProof(str_contains(implode(' ', $headers), 'HttpOnly') && str_contains(implode(' ', $headers), 'secure') && $claimedCookie !== $a, 'claim rotates the Secure HttpOnly player cookie');
    [$status] = accessRequest($base, 'GET', '/api/v1/player', null, $a); accessProof($status === 401, 'pre-claim cookie cannot read the character');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/logout', [], $claimedCookie, 'https://evil.test'); accessProof($status === 403, 'logout is CSRF protected');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/logout', [], $claimedCookie); accessProof($status === 200, 'logout revokes player access through the real HTTP route');
    [$status] = accessRequest($base, 'GET', '/api/v1/player', null, $claimedCookie); accessProof($status === 401, 'logged-out player cookie cannot be replayed');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/login', [...$credentials, 'password' => 'incorrect isolated password']); accessProof($status === 401, 'wrong credentials fail with HTTP 401');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/login', $credentials, '', 'https://evil.test'); accessProof($status === 403, 'sign-in is protected against login CSRF');
    [$status, $signedIn, $headers] = accessRequest($base, 'POST', '/api/v1/auth/login', $credentials); $loginCookie = accessCookie($headers);
    accessProof($status === 200 && $signedIn['playerId'] === $first['playerId'] && !isset($signedIn['recoveryCode'], $signedIn['token']), 'cookie-free sign-in restores the same character without returning recovery material');
    [$status, $restored] = accessRequest($base, 'GET', '/api/v1/player', null, $loginCookie);
    accessProof($status === 200 && $restored['player']['cash'] === 2400 && $restored['player']['bank_balance'] === 100 && $restored['player']['username'] === $credentials['username'], 'real HTTP sign-in restores saved cash, bank and name');
    [$status, $family] = accessRequest($base, 'GET', '/api/v1/city/map', null, $loginCookie); accessProof($status === 200 && $family['playerFactionId'] === 'vipers', 'family survives logout and cookie-free login');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/recover', [...$credentials, 'recoveryCode' => str_repeat('b', 64)]); accessProof($status === 401, 'invalid backup code cannot reset credentials');
    $recovery = [...$credentials, 'password' => 'replacement isolated password', 'recoveryCode' => $claim['recoveryCode']];
    [$status, $recovered, $headers] = accessRequest($base, 'POST', '/api/v1/auth/recover', $recovery); $recoveryCookie = accessCookie($headers);
    accessProof($status === 200 && $recovered['playerId'] === $first['playerId'] && $recovered['recoveryCode'] !== $claim['recoveryCode'], 'recovery issues a replacement backup code and restores the same account');
    [$status] = accessRequest($base, 'GET', '/api/v1/player', null, $loginCookie); accessProof($status === 401, 'password recovery revokes prior device sessions');
    [$status] = accessRequest($base, 'POST', '/api/v1/auth/recover', $recovery); accessProof($status === 401, 'HTTP recovery backup code is single-use');
    [$status] = accessRequest($base, 'GET', '/api/v1/auth/account', null, $recoveryCookie); accessProof($status === 200, 'recovered cookie resolves the permanent account');
    [$status, $otherPlayer] = accessRequest($base, 'GET', '/api/v1/player', null, $b); accessProof($status === 200 && $otherPlayer['player']['cash'] === 2500, 'recovery never revokes or modifies another player');
    [$status] = accessRequest($base, 'POST', '/api/v1/admin/releases/publish', [], $owner, 'https://evil.test'); accessProof($status === 403, 'a stolen owner cookie does not bypass publication CSRF checks');
    [$status, $draft] = accessRequest($base, 'GET', '/api/v1/admin/draft', null, $owner);
    accessProof($status === 200 && preg_match('/^[a-f0-9]{64}$/D', $draft['draftFingerprint'] ?? '') === 1, 'authorized owner reads the exact current configuration fingerprint');
    [$status, $missing] = accessRequest($base, 'POST', '/api/v1/admin/releases/publish', [], $owner);
    accessProof($status === 422 && $missing['error'] === 'A valid release draft fingerprint is required.', 'authorized publication without a reviewed fingerprint is rejected');
    [$status] = accessRequest($base, 'PUT', '/api/v1/admin/draft', ['manifest' => $draft['manifest']], $owner);
    accessProof($status === 422, 'authorized draft save also requires its reviewed fingerprint');
    $edited = $draft['manifest']; $edited['brand']['name'] = 'HTTP reviewed owner draft';
    [$status, $savedDraft] = accessRequest($base, 'PUT', '/api/v1/admin/draft', ['manifest' => $edited, 'expectedFingerprint' => $draft['draftFingerprint']], $owner);
    accessProof($status === 200 && $savedDraft['draftFingerprint'] !== $draft['draftFingerprint'], 'current owner fingerprint permits a real draft edit and returns its new guard');
    [$status] = accessRequest($base, 'PUT', '/api/v1/admin/draft', ['manifest' => $draft['manifest'], 'expectedFingerprint' => $draft['draftFingerprint']], $owner);
    accessProof($status === 409, 'stale owner draft cannot overwrite the committed HTTP edit');
    [$status] = accessRequest($base, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => $draft['draftFingerprint']], $owner);
    accessProof($status === 409, 'stale owner publication is a conflict rather than an unseen release');
    [$status, $reviewedDraft] = accessRequest($base, 'GET', '/api/v1/admin/draft', null, $owner);
    accessProof($status === 200 && $reviewedDraft['manifest']['brand']['name'] === $edited['brand']['name'], 'rejected stale requests preserve the owner draft for review');
    [$status, $release] = accessRequest($base, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => $reviewedDraft['draftFingerprint']], $owner);
    accessProof($status === 201 && $release['version'] === 1, 'owner session can publish an immutable reviewed release through the actual HTTP route');
    [$status] = accessRequest($base, 'POST', '/api/v1/admin/releases/publish', ['expectedFingerprint' => $reviewedDraft['draftFingerprint']], $owner);
    accessProof($status === 409, 'replayed reviewed publication cannot create a second release');
    [$status] = accessRequest($base, 'DELETE', '/api/v1/admin/session', null, $owner); accessProof($status === 200, 'owner logout expires browser access');
    [$status] = accessRequest($base, 'GET', '/api/v1/admin/draft'); accessProof($status === 401, 'a browser without the owner cookie cannot regain control-plane access');
} finally { proc_terminate($process); proc_close($process); }
[$base, $process] = accessServer('');
try {
    [$status, $access] = accessRequest($base, 'GET', '/api/v1/admin/session');
    accessProof($status === 200 && !$access['configured'] && !$access['authenticated'] && !$access['localDevelopment'], 'a missing production owner secret is an explicit locked configuration');
    [$status] = accessRequest($base, 'POST', '/api/v1/admin/releases/publish', []); accessProof($status === 401, 'production with no owner secret cannot publish even from the same origin');
} finally { proc_terminate($process); proc_close($process); }
echo "ACCESS HTTP RESULT: {$passed} passed, 0 failed\n";

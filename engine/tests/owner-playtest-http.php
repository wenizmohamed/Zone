<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Security\RequestGuard;

$passed = 0;
function playHttpProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function playHttp(string $base, string $method, string $path, ?array $body = null, string $cookies = '', string $origin = 'https://owner-playtest.test', array $extra = []): array {
    $headers = ['Host: owner-playtest.test', 'X-Forwarded-Proto: https', 'Accept: application/json', 'Content-Type: application/json', 'Connection: close', ...$extra];
    if ($cookies !== '') $headers[] = 'Cookie: ' . $cookies;
    if ($origin !== '') $headers[] = 'Origin: ' . $origin;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 15]]);
    $raw = @file_get_contents($base . $path, false, $context); $responseHeaders = http_get_last_response_headers() ?: [];
    preg_match('/\s(\d{3})\s/', $responseHeaders[0] ?? '', $match);
    return [(int) ($match[1] ?? 0), $raw === false || $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR), $responseHeaders];
}
function playCookie(array $headers): string { foreach ($headers as $header) if (stripos($header, 'Set-Cookie: ') === 0) return explode(';', substr($header, 12), 2)[0]; throw new RuntimeException('Player cookie not issued.'); }
$prefix = ZONE_ENGINE_ROOT . '/var/owner-playtest-http-' . bin2hex(random_bytes(6));
$socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error); if (!$socket) throw new RuntimeException($error);
$address = stream_socket_get_name($socket, false); fclose($socket);
$secret = 'isolated-owner-playtest-secret-not-production';
$environment = [...getenv(), 'ZONE_DATABASE_URL' => 'sqlite:' . $prefix . '.sqlite', 'DATABASE_URL' => '', 'POSTGRES_URL' => '', 'VERCEL' => '1', 'ZONE_ADMIN_TOKEN' => $secret, 'ZONE_PLAYER_AUTH' => '', 'ZONE_PLAYER_SESSIONS' => '1'];
$process = proc_open([PHP_BINARY, '-S', $address, '-t', ZONE_REPOSITORY_ROOT, ZONE_ENGINE_ROOT . '/router.php'], [0 => ['pipe', 'r'], 1 => ['file', $prefix . '.log', 'a'], 2 => ['file', $prefix . '.log', 'a']], $pipes, ZONE_REPOSITORY_ROOT, $environment, ['bypass_shell' => true]);
if (!is_resource($process)) throw new RuntimeException('Isolated owner-test HTTP server failed to start.'); fclose($pipes[0]); $base = 'http://' . $address;
try {
    for ($i = 0; $i < 50; $i++) { [$status] = playHttp($base, 'GET', '/api/v1/health'); if ($status === 200) break; usleep(100000); }
    playHttpProof($status === 200, 'isolated HTTP engine initializes normally');
    [, $a, $headers] = playHttp($base, 'POST', '/api/v1/auth/session', []); $playerCookie = playCookie($headers);
    [, $b, $headers] = playHttp($base, 'POST', '/api/v1/auth/session', []); $otherCookie = playCookie($headers);
    $ownerCookie = RequestGuard::ADMIN_COOKIE . '=' . RequestGuard::adminSession($secret);
    $both = $ownerCookie . '; ' . $playerCookie;
    foreach (['GET' => '/api/v1/admin/playtest', 'POST' => '/api/v1/admin/playtest/start', 'DELETE' => '/api/v1/admin/playtest'] as $method => $path) {
        [$status] = playHttp($base, $method, $path, ['idempotencyKey' => str_repeat('x', 24)], $playerCookie);
        playHttpProof($status === 401, 'regular player is denied owner playtest ' . $method);
    }
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => str_repeat('a', 24)], $ownerCookie);
    playHttpProof($status === 401, 'owner without server-resolved player session cannot start a sandbox');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => str_repeat('a', 24)], $both, 'https://evil.test');
    playHttpProof($status === 403, 'owner sandbox start is protected against cross-origin requests');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => str_repeat('a', 24)], $both, '');
    playHttpProof($status === 401, 'owner cookie mutations require an Origin header');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => str_repeat('a', 24), 'playerId' => $b['playerId']], $both);
    playHttpProof($status === 422, 'sandbox start rejects client-supplied player identity');
    [$status, $s] = playHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => str_repeat('a', 24)], $both);
    playHttpProof($status === 201 && $s['active'] && $s['mode'] === 'owner-playtest', 'owner plus player session starts a labeled sandbox through actual HTTP');
    $sandboxId = $s['gameplay']['player']['id'];
    [$status] = playHttp($base, 'GET', '/api/v1/player', null, $both, 'https://owner-playtest.test', ['X-Zone-Player-Id: ' . $sandboxId]);
    playHttpProof($status === 401, 'temporary sandbox ID cannot be claimed through normal gameplay route');
    [$status] = playHttp($base, 'GET', '/api/v1/admin/playtest', null, $playerCookie);
    playHttpProof($status === 401, 'owner reauthorization is required on every sandbox read');
    $request = ['sessionId' => $s['sessionId'], 'idempotencyKey' => str_repeat('b', 24), 'expectedVersion' => $s['version'], 'action' => 'bank.deposit', 'amount' => 100];
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', $request, $playerCookie);
    playHttpProof($status === 401, 'saved sandbox state does not bypass revoked owner access');
    [$status, $settled] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', $request, $both);
    playHttpProof($status === 200 && $settled['gameplay']['player']['bank_balance'] === 100, 'owner HTTP action executes real bank settlement in sandbox');
    [$status, $replay] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', $request, $both);
    playHttpProof($status === 200 && $replay === $settled, 'HTTP action replay is exactly idempotent');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', [...$request, 'idempotencyKey' => str_repeat('c', 24)], $both);
    playHttpProof($status === 409, 'stale HTTP sandbox version returns conflict');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', [...$request, 'amount' => 200], $both);
    playHttpProof($status === 409, 'HTTP idempotency-key payload mismatch returns conflict');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', [...$request, 'action' => 'faction.contribute', 'expectedVersion' => $settled['version']], $both);
    playHttpProof($status === 422, 'owner sandbox shared economy actions fail closed');
    [, $normal] = playHttp($base, 'GET', '/api/v1/gameplay', null, $playerCookie);
    [, $other] = playHttp($base, 'GET', '/api/v1/gameplay', null, $otherCookie);
    playHttpProof($normal['player']['cash'] === 2500 && $normal['player']['bank_balance'] === 0 && $normal['state']['inv'] === ['smallkit' => 1], 'real owner account retains original novice funds and inventory');
    playHttpProof($other['player']['cash'] === 2500 && $other['player']['bank_balance'] === 0, 'other player remains unchanged');
    [$status, $ownMap] = playHttp($base, 'GET', '/api/v1/city/map', null, $both);
    playHttpProof($status === 200 && count($ownMap['territories'] ?? $ownMap['blocks'] ?? []) > 0, 'map browsing remains available during owner playtest');
    [$status, $ended] = playHttp($base, 'DELETE', '/api/v1/admin/playtest', ['sessionId' => $s['sessionId'], 'idempotencyKey' => str_repeat('d', 24)], $both);
    playHttpProof($status === 200 && !$ended['active'] && $ended['restoredPlayerId'] === $a['playerId'], 'owner HTTP exit returns the original player identity');
    [$status, $newSession] = playHttp($base, 'POST', '/api/v1/admin/playtest/start', ['idempotencyKey' => str_repeat('e', 24)], $both);
    playHttpProof($status === 201 && $newSession['version'] === 1 && $newSession['sessionId'] !== $s['sessionId'], 'new HTTP sandbox has a distinct identity even though version restarts at1');
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', $request, $both);
    playHttpProof($status === 409, 'captured old-session version1 bank request cannot settle in new version1 sandbox');
    [$status] = playHttp($base, 'DELETE', '/api/v1/admin/playtest', ['sessionId' => $s['sessionId'], 'idempotencyKey' => str_repeat('d', 24)], $both);
    playHttpProof($status === 409, 'captured old-session exit cannot deactivate new sandbox');
    [, $stillNew] = playHttp($base, 'GET', '/api/v1/admin/playtest', null, $both);
    playHttpProof($stillNew['active'] && $stillNew['sessionId'] === $newSession['sessionId'] && $stillNew['gameplay']['player']['bank_balance'] === 0, 'new sandbox remains active with unchanged funds after hostile replays');
    $noSession = $request; unset($noSession['sessionId']);
    [$status] = playHttp($base, 'POST', '/api/v1/admin/playtest/action', $noSession, $both);
    playHttpProof($status === 422, 'HTTP owner action requires explicit current sessionId');
    [$status] = playHttp($base, 'DELETE', '/api/v1/admin/playtest', ['idempotencyKey' => str_repeat('f', 24)], $both);
    playHttpProof($status === 422, 'HTTP owner exit requires explicit sessionId');
    [$status] = playHttp($base, 'DELETE', '/api/v1/admin/playtest', ['sessionId' => $newSession['sessionId'], 'idempotencyKey' => str_repeat('g', 24)], $both);
    playHttpProof($status === 200, 'new sandbox exits only through its own identity');
    $db = \Zone\Engine\Core\Persistence\Database::connect('sqlite:' . $prefix . '.sqlite');
    playHttpProof($db->fetchOne("SELECT id FROM players WHERE id LIKE 'owner-playtest-%'") === null, 'temporary identity is absent after all HTTP requests');
    echo 'OWNER PLAYTEST HTTP RESULT: ' . $passed . ' passed, 0 failed' . PHP_EOL;
} finally { proc_terminate($process); proc_close($process); }

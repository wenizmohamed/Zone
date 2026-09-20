<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$repositoryRoot = realpath(__DIR__ . '/..');
$staticCandidate = realpath($repositoryRoot . str_replace('/', DIRECTORY_SEPARATOR, $path));

if ($path !== '/engine' && $path !== '/engine/' && !str_starts_with($path, '/api/')) {
    if ($staticCandidate !== false && str_starts_with($staticCandidate, $repositoryRoot) && is_file($staticCandidate)) {
        return false;
    }
}

if ($path === '/engine/assets/engine.css' || $path === '/engine/assets/engine.js') {
    $file = __DIR__ . '/public/assets/' . basename($path);
    header('Content-Type: ' . (str_ends_with($file, '.css') ? 'text/css' : 'application/javascript') . '; charset=utf-8');
    header('Cache-Control: no-store');
    readfile($file);
    return true;
}

if ($method === 'GET' && $path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(ZONE_REPOSITORY_ROOT . '/index.html');
    return true;
}

if ($method === 'GET' && ($path === '/admin' || $path === '/admin/')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(ZONE_REPOSITORY_ROOT . '/admin.html');
    return true;
}

try {
    $engine = zone_engine();
} catch (Throwable $exception) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode([
        'error' => 'ZONE engine initialization failed.',
        'type' => $exception::class,
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    return true;
}

if ($path === '/engine/theme.css') {
    header('Content-Type: text/css; charset=utf-8');
    header('Cache-Control: no-store');
    echo $engine->activeThemeStylesheet();
    return true;
}

if (($path === '/engine' || $path === '/engine/') && $method === 'GET') {
    require __DIR__ . '/public/console.php';
    return true;
}

function json_response(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        throw new RuntimeException('Request body must be a JSON object.');
    }
    return $decoded;
}

function require_admin_mutation(): void
{
    require_same_origin();
}

function require_same_origin(): void
{
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') {
        return;
    }
    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0];
    if (!is_string($originHost) || $originHost === '' || !hash_equals(strtolower($requestHost), strtolower($originHost))) {
        throw new RuntimeException('Cross-origin admin request rejected.');
    }
}

function request_actor(): string
{
    return 'admin-panel';
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($method === 'GET' && $path === '/api/v1/health') {
        json_response(['ok' => true, 'time' => gmdate('c'), 'engine' => $engine->status()]);
    }
    if ($method === 'GET' && $path === '/api/v1/engine') {
        json_response($engine->status());
    }
    if ($method === 'GET' && $path === '/api/v1/modules') {
        json_response(['modules' => $engine->modules()]);
    }
    if ($method === 'GET' && $path === '/api/v1/themes') {
        json_response(['themes' => $engine->themes()]);
    }
    if ($method === 'GET' && $path === '/api/v1/player') {
        json_response(['player' => $engine->player($_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player')]);
    }
    if ($method === 'GET' && $path === '/api/v1/crimes') {
        json_response(['crimes' => $engine->crimes()]);
    }
    if ($method === 'GET' && $path === '/api/v1/ledger') {
        json_response(['entries' => $engine->ledger()]);
    }
    if ($method === 'GET' && $path === '/api/v1/events') {
        json_response(['events' => $engine->eventLog()]);
    }
    if ($method === 'GET' && $path === '/api/v1/achievements') {
        json_response(['achievements' => $engine->achievements($_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player')]);
    }
    if ($method === 'GET' && $path === '/api/v1/architecture') {
        json_response([
            'requestFlow' => ['Web or Mobile Client', 'REST API v1', 'Application Use Case', 'Domain Core', 'Port', 'Adapter'],
            'infrastructure' => ['PHP 8.5', 'PostgreSQL persistent storage', 'Redis contract', 'Workers and jobs schema', 'Object storage asset model'],
            'rule' => 'The domain and modules never depend on a frontend, database vendor, or theme.',
        ]);
    }
    if ($method === 'GET' && $path === '/api/v1/releases/active') {
        json_response($engine->activeRelease());
    }
    if ($method === 'GET' && $path === '/api/v1/game/bootstrap') {
        json_response($engine->gameBootstrap());
    }
    if ($method === 'GET' && $path === '/api/v1/admin/draft') {
        json_response($engine->releaseDraft());
    }
    if ($method === 'GET' && $path === '/api/v1/admin/releases') {
        json_response(['releases' => $engine->releaseHistory()]);
    }
    if ($method === 'GET' && $path === '/api/v1/admin/crimes') {
        json_response(['crimes' => $engine->adminCrimes()]);
    }
    if ($method === 'GET' && $path === '/api/v1/admin/audit') {
        json_response(['entries' => $engine->adminAuditLog()]);
    }
    if ($method === 'PUT' && $path === '/api/v1/admin/draft') {
        require_admin_mutation();
        $payload = request_json();
        json_response($engine->saveReleaseDraft($payload['manifest'] ?? $payload, request_actor()));
    }
    if ($method === 'POST' && $path === '/api/v1/admin/releases/publish') {
        require_admin_mutation();
        request_json();
        json_response($engine->publishRelease(request_actor()), 201);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/releases/([a-f0-9]{32})/activate$#', $path, $matches)) {
        require_admin_mutation();
        request_json();
        json_response($engine->activateRelease($matches[1], request_actor()));
    }
    if ($method === 'PUT' && preg_match('#^/api/v1/admin/crimes/([a-z0-9-]+)$#', $path, $matches)) {
        require_admin_mutation();
        json_response(['crime' => $engine->saveCrime($matches[1], request_json(), request_actor())]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/crimes/([a-z0-9-]+)/attempt$#', $path, $matches)) {
        request_json();
        json_response($engine->attemptCrime($matches[1], $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/modules/([a-z0-9-]+)/(install|uninstall|enable|disable)$#', $path, $matches)) {
        require_admin_mutation();
        json_response(['module' => $engine->changeModule($matches[1], $matches[2])]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/themes/([a-z0-9-]+)/activate$#', $path, $matches)) {
        require_admin_mutation();
        json_response(['theme' => $engine->activateTheme($matches[1])]);
    }
    if ($method === 'GET' && $path === '/api/v1/cities') {
        json_response(['cities' => $engine->cities()]);
    }
    if ($method === 'POST' && $path === '/api/v1/gym/train') {
        $body = request_json();
        json_response($engine->trainGym((string) ($body['stat'] ?? ''), (int) ($body['sessions'] ?? 1), $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && $path === '/api/v1/bank/deposit') {
        $body = request_json();
        json_response($engine->bankDeposit((int) ($body['amount'] ?? 0), $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && $path === '/api/v1/bank/withdraw') {
        $body = request_json();
        json_response($engine->bankWithdraw((int) ($body['amount'] ?? 0), $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && $path === '/api/v1/hospital/heal') {
        request_json();
        json_response($engine->hospitalHeal($_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && $path === '/api/v1/travel') {
        $body = request_json();
        json_response($engine->travel((string) ($body['city'] ?? ''), $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && $path === '/api/v1/casino/blackjack') {
        $body = request_json();
        json_response($engine->playBlackjack((int) ($body['bet'] ?? 0), $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    json_response(['error' => 'Route not found.', 'method' => $method, 'path' => $path], 404);
} catch (JsonException $exception) {
    json_response(['error' => 'Invalid JSON.', 'detail' => $exception->getMessage()], 400);
} catch (InvalidArgumentException $exception) {
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], 422);
} catch (RuntimeException $exception) {
    $message = $exception->getMessage();
    $status = match (true) {
        str_starts_with($message, 'Unknown release:') => 404,
        $message === 'Cross-origin admin request rejected.' => 403,
        str_starts_with($message, 'Production database is not configured.') => 503,
        default => 400,
    };
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], $status);
} catch (Throwable $exception) {
    $status = str_contains(strtolower($exception->getMessage()), 'not enough') ? 409 : 400;
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], $status);
}

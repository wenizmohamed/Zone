<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use Zone\Engine\Core\Security\AdminSession;

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
    if (AdminSession::current() === null) {
        header('Location: /admin', true, 302);
        return true;
    }
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

function require_admin(bool $mutation = false): array
{
    $session = AdminSession::requireAuthenticated();
    if ($mutation) {
        require_same_origin();
        AdminSession::requireCsrf($session, (string) ($_SERVER['HTTP_X_ZONE_CSRF_TOKEN'] ?? ''));
    }
    return $session;
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

function request_actor(array $session): string
{
    return (string) $session['username'];
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($method === 'GET' && $path === '/api/v1/admin/auth') {
        json_response(AdminSession::publicCurrent());
    }
    if ($method === 'POST' && $path === '/api/v1/admin/auth/login') {
        require_same_origin();
        $payload = request_json();
        $session = AdminSession::login((string) ($payload['username'] ?? ''), (string) ($payload['password'] ?? ''));
        if ($session === null) {
            json_response(['error' => 'Invalid username or password.'], 401);
        }
        json_response($session);
    }
    if ($method === 'POST' && $path === '/api/v1/admin/auth/logout') {
        $session = require_admin(true);
        AdminSession::logout();
        json_response(['authenticated' => false, 'signedOut' => $session['username']]);
    }
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
        require_admin();
        json_response(['entries' => $engine->ledger()]);
    }
    if ($method === 'GET' && $path === '/api/v1/events') {
        require_admin();
        json_response(['events' => $engine->eventLog()]);
    }
    if ($method === 'GET' && $path === '/api/v1/achievements') {
        require_admin();
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
    if ($method === 'GET' && $path === '/api/v1/admin/draft') {
        require_admin();
        json_response($engine->releaseDraft());
    }
    if ($method === 'GET' && $path === '/api/v1/admin/releases') {
        require_admin();
        json_response(['releases' => $engine->releaseHistory()]);
    }
    if ($method === 'GET' && $path === '/api/v1/admin/crimes') {
        require_admin();
        json_response(['crimes' => $engine->adminCrimes()]);
    }
    if ($method === 'GET' && $path === '/api/v1/admin/audit') {
        require_admin();
        json_response(['entries' => $engine->adminAuditLog()]);
    }
    if ($method === 'PUT' && $path === '/api/v1/admin/draft') {
        $session = require_admin(true);
        $payload = request_json();
        json_response($engine->saveReleaseDraft($payload['manifest'] ?? $payload, request_actor($session)));
    }
    if ($method === 'POST' && $path === '/api/v1/admin/releases/publish') {
        $session = require_admin(true);
        request_json();
        json_response($engine->publishRelease(request_actor($session)), 201);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/releases/([a-f0-9]{32})/activate$#', $path, $matches)) {
        $session = require_admin(true);
        request_json();
        json_response($engine->activateRelease($matches[1], request_actor($session)));
    }
    if ($method === 'PUT' && preg_match('#^/api/v1/admin/crimes/([a-z0-9-]+)$#', $path, $matches)) {
        $session = require_admin(true);
        json_response(['crime' => $engine->saveCrime($matches[1], request_json(), request_actor($session))]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/crimes/([a-z0-9-]+)/attempt$#', $path, $matches)) {
        request_json();
        json_response($engine->attemptCrime($matches[1], $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'founder-player'));
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/modules/([a-z0-9-]+)/(install|uninstall|enable|disable)$#', $path, $matches)) {
        require_admin(true);
        json_response(['module' => $engine->changeModule($matches[1], $matches[2])]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/themes/([a-z0-9-]+)/activate$#', $path, $matches)) {
        require_admin(true);
        json_response(['theme' => $engine->activateTheme($matches[1])]);
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
        $message === 'Admin authentication required.' => 401,
        $message === 'Invalid admin CSRF token.', $message === 'Cross-origin admin request rejected.' => 403,
        $message === 'Admin authentication is not configured.', str_starts_with($message, 'Production database is not configured.') => 503,
        default => 400,
    };
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], $status);
} catch (Throwable $exception) {
    $status = str_contains(strtolower($exception->getMessage()), 'not enough') ? 409 : 400;
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], $status);
}

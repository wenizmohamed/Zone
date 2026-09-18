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

$engine = zone_engine();

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

function require_admin(): void
{
    if (getenv('ZONE_DEMO_MODE') === '1') {
        return;
    }
    $expected = getenv('ZONE_ADMIN_TOKEN') ?: '';
    $provided = $_SERVER['HTTP_X_ZONE_ADMIN_TOKEN'] ?? '';
    if ($expected === '' || !hash_equals($expected, $provided)) {
        json_response(['error' => 'Admin authorization required.'], 401);
    }
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
        json_response(['player' => $engine->player($_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'demo-player')]);
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
        json_response(['achievements' => $engine->achievements($_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'demo-player')]);
    }
    if ($method === 'GET' && $path === '/api/v1/architecture') {
        json_response([
            'requestFlow' => ['Web or Mobile Client', 'REST API v1', 'Application Use Case', 'Domain Core', 'Port', 'Adapter'],
            'infrastructure' => ['PHP 8.5', 'PostgreSQL production schema', 'SQLite presentation adapter', 'Redis contract', 'Workers and jobs schema', 'Object storage asset model'],
            'rule' => 'The domain and modules never depend on a frontend, database vendor, or theme.',
        ]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/crimes/([a-z0-9-]+)/attempt$#', $path, $matches)) {
        request_json();
        json_response($engine->attemptCrime($matches[1], $_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? 'demo-player'));
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/modules/([a-z0-9-]+)/(install|uninstall|enable|disable)$#', $path, $matches)) {
        require_admin();
        json_response(['module' => $engine->changeModule($matches[1], $matches[2])]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/themes/([a-z0-9-]+)/activate$#', $path, $matches)) {
        require_admin();
        json_response(['theme' => $engine->activateTheme($matches[1])]);
    }
    json_response(['error' => 'Route not found.', 'method' => $method, 'path' => $path], 404);
} catch (JsonException $exception) {
    json_response(['error' => 'Invalid JSON.', 'detail' => $exception->getMessage()], 400);
} catch (Throwable $exception) {
    $status = str_contains(strtolower($exception->getMessage()), 'not enough') ? 409 : 400;
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], $status);
}

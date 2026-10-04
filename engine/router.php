<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

/** Diagnostic metadata only: never log credentials, request bodies or SQL values. */
function log_engine_failure(Throwable $exception, string $route): string
{
    $requestId = bin2hex(random_bytes(8));
    error_log(json_encode(['event' => 'zone.engine.error', 'requestId' => $requestId, 'route' => $route,
        'type' => $exception::class, 'file' => basename($exception->getFile()), 'line' => $exception->getLine()], JSON_THROW_ON_ERROR));
    return $requestId;
}

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
    $requestId = log_engine_failure($exception, $path);
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode([
        'error' => 'ZONE engine initialization failed.',
        'type' => $exception::class,
        'requestId' => $requestId,
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

function zone_env(string $name): ?string
{
    $value = getenv($name);
    if ($value === false) {
        return null;
    }
    $value = trim($value);
    return $value === '' ? null : $value;
}

/**
 * Authorize an admin/mutation request and return the actor label to record in
 * the audit trail. Production requires ZONE_ADMIN_TOKEN via X-Zone-Admin-Token;
 * demo mode (no token) requires a strict same-origin request. A header-less
 * client (curl/bot/server-to-server) can no longer write.
 */
function require_admin_mutation(): string
{
    return \Zone\Engine\Core\Security\RequestGuard::authorizeAdmin($_SERVER, zone_env('ZONE_ADMIN_TOKEN'), getenv('VERCEL') === '1');
}

/**
 * Resolve the acting player id server-side. Never trusts the raw
 * X-Zone-Player-Id header: in demo mode identity is pinned to the demo player;
 * in production a valid HMAC player token is required to assume an identity.
 */
function current_player_id(): string
{
    return \Zone\Engine\Core\Security\RequestGuard::resolvePlayerId(
        $_SERVER,
        zone_env('ZONE_PLAYER_AUTH'),
        zone_env('ZONE_DEMO_PLAYER_ID') ?? 'founder-player',
    );
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
        json_response(['player' => $engine->player(current_player_id())]);
    }
    if ($method === 'GET' && $path === '/api/v1/gameplay') {
        json_response($engine->gameplay(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/combat') {
        json_response($engine->combat(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/combat/action') {
        $body = request_json();
        json_response($engine->combatAction((string) ($body['action'] ?? ''), (string) ($body['opponentId'] ?? ''), (string) ($body['approach'] ?? ''), \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion'), current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/gameplay/action') {
        $body = request_json();
        $expectedPrice = array_key_exists('expectedPrice', $body) ? \Zone\Engine\Core\Security\RequestGuard::nonNegativeInt($body, 'expectedPrice') : null;
        json_response($engine->gameplayAction((string) ($body['action'] ?? ''), (string) ($body['id'] ?? ''), \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion'), current_player_id(), $expectedPrice));
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
        json_response(['achievements' => $engine->achievements(current_player_id())]);
    }
    if ($method === 'GET' && $path === '/api/v1/city/map') {
        json_response($engine->territoryMap(current_player_id()));
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
    if ($method === 'GET' && $path === '/api/v1/admin/gameplay-catalog') {
        json_response($engine->adminGameplayCatalog());
    }
    if ($method === 'PUT' && preg_match('#^/api/v1/admin/gameplay-catalog/([a-z]+)/([A-Za-z0-9_-]+)$#', $path, $matches)) {
        $actor = require_admin_mutation();
        $body = request_json();
        if (!is_array($body['changes'] ?? null)) throw new InvalidArgumentException('Catalog changes must be a field object.');
        json_response($engine->saveGameplayCatalog($matches[1], $matches[2], $body['changes'], \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedRevision'), $actor));
    }
    if ($method === 'GET' && $path === '/api/v1/admin/audit') {
        json_response(['entries' => $engine->adminAuditLog()]);
    }
    if ($method === 'GET' && $path === '/api/v1/admin/territories') {
        json_response($engine->adminTerritories(current_player_id()));
    }
    if ($method === 'PUT' && $path === '/api/v1/admin/draft') {
        $actor = require_admin_mutation();
        $payload = request_json();
        json_response($engine->saveReleaseDraft($payload['manifest'] ?? $payload, $actor));
    }
    if ($method === 'POST' && $path === '/api/v1/admin/releases/publish') {
        $actor = require_admin_mutation();
        request_json();
        json_response($engine->publishRelease($actor), 201);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/releases/([a-f0-9]{32})/activate$#', $path, $matches)) {
        $actor = require_admin_mutation();
        request_json();
        json_response($engine->activateRelease($matches[1], $actor));
    }
    if ($method === 'PUT' && preg_match('#^/api/v1/admin/crimes/([a-z0-9-]+)$#', $path, $matches)) {
        $actor = require_admin_mutation();
        json_response(['crime' => $engine->saveCrime($matches[1], request_json(), $actor)]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/territories/(ZC-[0-9]{3})/ownership$#', $path, $matches)) {
        $actor = require_admin_mutation();
        $body = request_json();
        $factionId = array_key_exists('factionId', $body) && $body['factionId'] !== null
            ? (string) $body['factionId']
            : null;
        json_response($engine->setTerritoryOwnership($matches[1], $factionId, $actor));
    }
    if ($method === 'POST' && preg_match('#^/api/v1/crimes/([a-z0-9-]+)/attempt$#', $path, $matches)) {
        request_json();
        json_response($engine->attemptCrime($matches[1], current_player_id()));
    }
    if ($method === 'POST' && preg_match('#^/api/v1/territories/(ZC-[0-9]{3})/action$#', $path, $matches)) {
        $body = request_json();
        $expectedVersion = \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion');
        json_response($engine->actTerritory($matches[1], (string) ($body['action'] ?? ''), $expectedVersion, current_player_id()));
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
        $sessions = \Zone\Engine\Core\Security\RequestGuard::boundedInt($body, 'sessions', 1, 10, 1);
        json_response($engine->trainGym((string) ($body['stat'] ?? ''), $sessions, current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/bank/deposit') {
        $body = request_json();
        json_response($engine->bankDeposit(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'amount'), current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/bank/withdraw') {
        $body = request_json();
        json_response($engine->bankWithdraw(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'amount'), current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/hospital/heal') {
        request_json();
        json_response($engine->hospitalHeal(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/travel') {
        $body = request_json();
        json_response($engine->travel((string) ($body['city'] ?? ''), current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/casino/blackjack') {
        $body = request_json();
        json_response($engine->playBlackjack(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'bet'), current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/casino/high-low') {
        json_response($engine->highLowState(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/hospital/quote') {
        json_response($engine->hospitalQuote(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/travel') {
        json_response($engine->travelState(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/casino/high-low') {
        $body = request_json();
        json_response($engine->playHighLow(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'bet'), (string) ($body['direction'] ?? ''), \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion'), current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/jobs/work') {
        request_json();
        json_response($engine->workShift(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/attack') {
        request_json();
        json_response($engine->attackNpc(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/daily/login') {
        request_json();
        json_response(['streak' => $engine->dailyLogin(current_player_id())]);
    }
    if ($method === 'GET' && $path === '/api/v1/daily/contract') {
        json_response($engine->dailyContract(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/daily/contract/claim') {
        request_json();
        json_response($engine->claimDailyContract(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/notifications') {
        json_response(['notifications' => $engine->notifications(current_player_id())]);
    }
    json_response(['error' => 'Route not found.', 'method' => $method, 'path' => $path], 404);
} catch (JsonException $exception) {
    json_response(['error' => 'Invalid JSON.', 'detail' => $exception->getMessage()], 400);
} catch (\Zone\Engine\Core\Game\CooldownException $exception) {
    header('Retry-After: ' . $exception->retryAfter);
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class, 'action' => $exception->action, 'retryAfter' => $exception->retryAfter], 429);
} catch (\Zone\Engine\Core\Game\RateLimitException $exception) {
    header('Retry-After: ' . $exception->retryAfter);
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class, 'retryAfter' => $exception->retryAfter], 429);
} catch (InvalidArgumentException $exception) {
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], 422);
} catch (PDOException $exception) {
    $requestId = log_engine_failure($exception, $path);
    json_response(['error' => 'The engine could not complete this request.', 'requestId' => $requestId], 500);
} catch (RuntimeException $exception) {
    $message = $exception->getMessage();
    $status = match (true) {
        str_starts_with($message, 'Unknown release:') => 404,
        $message === 'Cross-origin admin request rejected.' => 403,
        $message === 'Admin authentication required.' => 401,
        $message === 'Player authentication required to act as another player.' => 401,
        $message === 'Player authentication failed.' => 401,
        $message === 'Player identity header is required.' => 401,
        str_starts_with($message, 'Territory state changed.') => 409,
        str_starts_with($message, 'Casino round changed.') => 409,
        str_starts_with($message, 'Gameplay state changed.') => 409,
        str_starts_with($message, 'Gameplay catalog changed.') => 409,
        str_starts_with($message, 'Progression state changed.') => 409,
        str_starts_with($message, 'The market price changed.') => 409,
        str_starts_with($message, 'Combat state changed.') => 409,
        str_starts_with($message, 'Control an adjacent block') => 409,
        str_starts_with($message, 'A first foothold') => 409,
        str_starts_with($message, 'A territory war is already active') => 409,
        str_starts_with($message, 'Production database is not configured.') => 503,
        default => 400,
    };
    json_response(['error' => $exception->getMessage(), 'type' => $exception::class], $status);
} catch (Throwable $exception) {
    $requestId = log_engine_failure($exception, $path);
    json_response(['error' => 'The engine could not complete this request.', 'requestId' => $requestId], 500);
}

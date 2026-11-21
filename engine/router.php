<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

// Only an authenticated loopback relay can supply the public request context.
$zoneGatewayRequest = false;
$gatewayKey = (string) (getenv('ZONE_ENGINE_RELAY_KEY') ?: '');
if (isset($_SERVER['HTTP_X_ZONE_GATEWAY_KEY'])) {
    $gatewayHost = (string) ($_SERVER['HTTP_X_ZONE_GATEWAY_HOST'] ?? '');
    $allowedHosts = array_filter(array_map('trim', explode(',', (string) (getenv('ZONE_ENGINE_PUBLIC_HOSTS') ?: ''))));
    $gatewayIp = (string) ($_SERVER['HTTP_X_ZONE_GATEWAY_IP'] ?? '');
    if (strlen($gatewayKey) < 32 || !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
        || !hash_equals($gatewayKey, (string) $_SERVER['HTTP_X_ZONE_GATEWAY_KEY'])
        || !in_array($gatewayHost, $allowedHosts, true)
        || ($_SERVER['HTTP_X_ZONE_GATEWAY_PROTO'] ?? '') !== 'https'
        || !filter_var($gatewayIp, FILTER_VALIDATE_IP)) {
        http_response_code(403); header('Content-Type: application/json'); echo '{"error":"Gateway authentication failed."}'; return true;
    }
    $zoneGatewayRequest = true;
    $_SERVER['HTTP_HOST'] = $gatewayHost;
    $_SERVER['HTTPS'] = 'on';
    $_SERVER['REMOTE_ADDR'] = $gatewayIp;
}

/** Diagnostic metadata only: never log credentials, request bodies or SQL values. */
function log_engine_failure(Throwable $exception, string $route): string
{
    $requestId = bin2hex(random_bytes(8));
    error_log(json_encode(['event' => 'zone.engine.error', 'requestId' => $requestId, 'route' => $route,
        'type' => $exception::class, 'file' => basename($exception->getFile()), 'line' => $exception->getLine()], JSON_THROW_ON_ERROR));
    return $requestId;
}

/** Admin writes must prove which draft/configuration the editor reviewed. */
function required_draft_fingerprint(array $payload): string
{
    $fingerprint = $payload['expectedFingerprint'] ?? null;
    if (!is_string($fingerprint) || !preg_match('/^[a-f0-9]{64}$/D', $fingerprint)) {
        throw new InvalidArgumentException('A valid release draft fingerprint is required.');
    }
    return $fingerprint;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Reject encoded separators/traversal before PHP's static-server fallback.
// Decode repeatedly so double-encoded private paths cannot become a second route.
for ($decode = 0; $decode < 5; $decode++) {
    $decoded = rawurldecode($path);
    if ($decoded === $path) break;
    $path = $decoded;
}
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$repositoryRoot = realpath(__DIR__ . '/..');
if (str_contains($path, "\0") || str_contains($path, '\\') || str_contains($path, '%')
    || preg_match('~(?:^|/)\.[^/]*(?:/|$)~', $path)
    || preg_match('~^/(?:docs|scripts|screenshots|brief|idea|analysis|artifacts)(?:/|$)~i', $path)
    || (str_starts_with(strtolower($path), '/engine/') && !in_array($path, ['/engine/', '/engine/theme.css', '/engine/assets/engine.css', '/engine/assets/studio-engine.css', '/engine/assets/engine.js'], true))) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found.';
    return true;
}
$staticCandidate = realpath($repositoryRoot . str_replace('/', DIRECTORY_SEPARATOR, $path));

if ($path !== '/engine' && $path !== '/engine/' && !str_starts_with($path, '/api/')) {
    if ($staticCandidate !== false && is_file($staticCandidate)) {
        // Match the build's public roots, not every existing file in this checkout.
        $publicFiles = ['index.html', 'admin.html', 'admin.css', 'admin.js', 'admin-studio.js', 'admin-assets.js', 'account.html', 'account.js', 'platform-runtime.js', 'owner-playtest.js', 'player-session.js', 'favicon.svg', 'favicon.ico', 'support.js', 'image-slot.js'];
        $relative = str_replace('\\', '/', substr($staticCandidate, strlen($repositoryRoot) + 1));
        $inside = str_starts_with($staticCandidate, $repositoryRoot . DIRECTORY_SEPARATOR);
        $public = in_array($relative, $publicFiles, true) || preg_match('~^(?:art|assets|dist|lib)/~', $relative);
        if ($inside && $public && !preg_match('~(?:^|/)\.|\.(?:php|sqlite[0-9]*|db|env|ini|log|toml|ps1|py)$~i', $relative)) return false;
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Not found.';
        return true;
    }
}

if (in_array($path, ['/engine/assets/engine.css', '/engine/assets/studio-engine.css', '/engine/assets/engine.js'], true)) {
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

if ($method === 'GET' && ($path === '/account' || $path === '/account/')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(ZONE_REPOSITORY_ROOT . '/account.html');
    return true;
}

/** Reuse the existing deployed owner credentials, never create a new owner. */
function zone_admin_settings(): array
{
    $settings = [];
    foreach (['ZONE_ADMIN_TOKEN', 'ZONE_ADMIN_USERNAME', 'ZONE_ADMIN_PASSWORD_HASH', 'ZONE_ADMIN_SESSION_SECRET'] as $name) $settings[$name] = trim((string) (getenv($name) ?: ''));
    return $settings;
}
function zone_admin_secret(): string
{
    $settings = zone_admin_settings();
    if ($settings['ZONE_ADMIN_TOKEN'] !== '') return $settings['ZONE_ADMIN_TOKEN'];
    return $settings['ZONE_ADMIN_USERNAME'] !== '' && (password_get_info($settings['ZONE_ADMIN_PASSWORD_HASH'])['algo'] ?? null) !== null
        && strlen($settings['ZONE_ADMIN_SESSION_SECRET']) >= 32 ? $settings['ZONE_ADMIN_SESSION_SECRET'] : '';
}
function zone_admin_access(): array
{
    global $zoneGatewayRequest;
    if (getenv('ZONE_BETA_OWNER_ACCESS') === '1') {
        return ['configured' => true, 'authenticated' => true, 'localDevelopment' => false,
            'credentialMode' => 'beta', 'betaTesting' => true];
    }
    $secret = zone_admin_secret();
    $local = !$zoneGatewayRequest && getenv('VERCEL') !== '1' && in_array(strtolower(explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0]), ['localhost', '127.0.0.1'], true);
    $authenticated = ($local && $secret === '') || ($zoneGatewayRequest && ($_SERVER['HTTP_X_ZONE_GATEWAY_OWNER'] ?? '') === '1');
    if ($secret !== '') {
        try { \Zone\Engine\Core\Security\RequestGuard::authorizeAdmin($_SERVER, $secret); $authenticated = true; }
        catch (RuntimeException) { $authenticated = false; }
    }
    return ['configured' => $secret !== '', 'authenticated' => $authenticated, 'localDevelopment' => $local,
        'credentialMode' => $secret === '' ? 'unconfigured' : (zone_admin_settings()['ZONE_ADMIN_TOKEN'] !== '' ? 'token' : 'password')];
}

function zone_cookie(string $name, string $value, int $expires): void
{
    setcookie($name, $value, ['expires' => $expires, 'path' => '/', 'secure' => getenv('VERCEL') === '1' || ($_SERVER['HTTPS'] ?? '') === 'on', 'httponly' => true, 'samesite' => 'Strict']);
}

// Owner access is independent of database availability.
if ($path === '/api/v1/admin/session') {
    $access = zone_admin_access();
    if ($method === 'GET') json_response($access);
    if ($method === 'POST') {
        try {
            \Zone\Engine\Core\Security\RequestGuard::assertSameOrigin($_SERVER, true, getenv('VERCEL') === '1');
            $secret = zone_admin_secret();
            $settings = zone_admin_settings();
            $body = request_json();
            $valid = $access['credentialMode'] === 'password'
                ? (is_string($body['username'] ?? null) && is_string($body['password'] ?? null)
                    && strlen($body['password']) <= 1024 && password_verify($body['password'], $settings['ZONE_ADMIN_PASSWORD_HASH'])
                    && hash_equals($settings['ZONE_ADMIN_USERNAME'], $body['username']))
                : (is_string($body['token'] ?? null) && hash_equals($secret, $body['token']));
            if ($secret === '' || !$valid) json_response(['error' => 'Admin authentication required.'], 401);
            zone_cookie(\Zone\Engine\Core\Security\RequestGuard::ADMIN_COOKIE, \Zone\Engine\Core\Security\RequestGuard::adminSession($secret), time() + 43200);
            json_response(['configured' => true, 'authenticated' => true, 'localDevelopment' => $access['localDevelopment']]);
        } catch (Throwable) { json_response(['error' => 'Admin authentication required.'], 401); }
    }
    if ($method === 'DELETE') {
        try { \Zone\Engine\Core\Security\RequestGuard::assertSameOrigin($_SERVER, true, getenv('VERCEL') === '1'); }
        catch (RuntimeException) { json_response(['error' => 'Cross-origin admin request rejected.'], 403); }
        zone_cookie(\Zone\Engine\Core\Security\RequestGuard::ADMIN_COOKIE, '', time() - 3600);
        json_response(['authenticated' => false]);
    }
}
if (str_starts_with($path, '/api/v1/admin/') || in_array($path, ['/engine', '/engine/', '/api/v1/ledger', '/api/v1/events'], true)) {
    if (!zone_admin_access()['authenticated']) json_response(['error' => 'Admin authentication required.'], 401);
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
    if (!empty($GLOBALS['__zone_ledger_cookie']) && !headers_sent()) {
        zone_cookie('zone_player_ledger', (string) $GLOBALS['__zone_ledger_cookie'], time() + 60 * 60 * 24 * 30);
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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
 * Authorize owner mutations and return server-fixed audit attribution.
 * Production accepts the signed owner cookie or a private server-to-server
 * token. Cookie writes require strict same-origin validation. Only loopback
 * development without a configured secret gets the local-admin shortcut.
 */
function require_admin_mutation(): string
{
    global $zoneGatewayRequest;
    $access = zone_admin_access();
    if (!$access['authenticated']) throw new RuntimeException('Admin authentication required.');
    if (empty($_SERVER['HTTP_X_ZONE_ADMIN_TOKEN'])) \Zone\Engine\Core\Security\RequestGuard::assertSameOrigin($_SERVER, true, getenv('VERCEL') === '1');
    if (!empty($access['betaTesting'])) return 'beta-owner';
    if ($zoneGatewayRequest && ($_SERVER['HTTP_X_ZONE_GATEWAY_OWNER'] ?? '') === '1') return 'admin-session';
    if (zone_admin_secret() === '') return 'local-admin';
    return \Zone\Engine\Core\Security\RequestGuard::authorizeAdmin($_SERVER, zone_admin_secret(), getenv('VERCEL') === '1');
}

/**
 * Resolve the acting player server-side. Browser sessions never trust a
 * claimed player ID. Legacy signed HMAC clients remain supported; only the
 * isolated legacy development adapter can use its pinned founder fixture.
 */
function current_player_id(): string
{
    global $engine;
    if (zone_sessions_enabled()) {
        $token = \Zone\Engine\Core\Security\RequestGuard::cookie($_SERVER, \Zone\Engine\Core\Security\BrowserSessions::COOKIE);
        if ($token !== '') {
            $id = $engine->browserSessions()->resolve($token);
            $claimed = trim((string) ($_SERVER['HTTP_X_ZONE_PLAYER_ID'] ?? ''));
            if ($claimed !== '' && $claimed !== $id) throw new RuntimeException('Player authentication failed.');
            $verb = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
            if (!in_array($verb, ['GET', 'HEAD', 'OPTIONS'], true)) \Zone\Engine\Core\Security\RequestGuard::assertSameOrigin($_SERVER, true, getenv('VERCEL') === '1');
            return $id;
        }
        if (zone_env('ZONE_PLAYER_AUTH') === null) throw new RuntimeException('Player session expired.');
    }
    return \Zone\Engine\Core\Security\RequestGuard::resolvePlayerId(
        $_SERVER,
        zone_env('ZONE_PLAYER_AUTH'),
        zone_env('ZONE_DEMO_PLAYER_ID') ?? 'founder-player',
    );
}

function zone_sessions_enabled(): bool
{
    return getenv('ZONE_PLAYER_SESSIONS') === '1' || getenv('VERCEL') === '1';
}

function zone_client_address(): string
{
    $address = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (getenv('VERCEL') === '1' && filter_var($_SERVER['HTTP_X_REAL_IP'] ?? '', FILTER_VALIDATE_IP)) $address = $_SERVER['HTTP_X_REAL_IP'];
    return $address;
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    // Owner proof and player identity are both server-resolved on every request.
    if ($path === '/api/v1/admin/assets/uploads' && $method === 'POST') {
        json_response($engine->assets()->begin(request_json(), require_admin_mutation()), 201);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/assets/uploads/([a-f0-9]{32})/(chunks|complete)$#D', $path, $matches)) {
        $actor = require_admin_mutation(); $body = request_json();
        json_response($matches[2] === 'chunks' ? $engine->assets()->append($matches[1], $body, $actor) : $engine->assets()->complete($matches[1], $actor));
    }
    if ($path === '/api/v1/admin/assets' && $method === 'GET') json_response(['assets' => $engine->assets()->all()]);
    if ($path === '/api/v1/admin/workers' && $method === 'GET') json_response($engine->assets()->health());
    if ($method === 'GET' && preg_match('#^/api/v1/admin/assets/([a-f0-9]{64})$#D', $path, $matches)) json_response($engine->assets()->get($matches[1]));
    if ($method === 'PUT' && preg_match('#^/api/v1/admin/assets/([a-f0-9]{64})/transform$#D', $path, $matches)) {
        $actor = require_admin_mutation(); json_response($engine->assets()->updateTransform($matches[1], request_json(), $actor));
    }
    if (preg_match('#^/api/v1/assets/([a-f0-9]{64})(/content)?$#D', $path, $matches)) {
        if (!in_array($method, ['GET', 'HEAD'], true)) json_response(['error' => 'Media is read-only.'], 405);
        $id = $matches[1];
        $draftMedia = ($_GET['draft'] ?? '') === '1' && zone_admin_access()['authenticated'];
        $asset = $draftMedia ? $engine->assets()->get($id) : ($engine->activeRelease()['manifest']['mediaAssets'][$id] ?? null);
        if (!is_array($asset) || ($asset['status'] ?? '') !== 'ready') json_response(['error' => 'Published media not found.'], 404);
        if (empty($matches[2])) json_response($asset);
        $member = $_GET['member'] ?? '';
        if (!is_string($member)) throw new InvalidArgumentException('Invalid media member.');
        $offset = \Zone\Engine\Core\Security\RequestGuard::boundedInt($_GET, 'offset', 0, 134217728, 0);
        $length = \Zone\Engine\Core\Security\RequestGuard::boundedInt($_GET, 'length', 1, 524288, 524288);
        json_response($engine->assets()->content($id, $member, $offset, $length));
    }
    if ($path === '/api/v1/world' && $method === 'GET') json_response($engine->world()->snapshot(current_player_id()));
    if ($path === '/api/v1/world/claim' && $method === 'POST') {
        $body = request_json();
        if (!is_string($body['findId'] ?? null) || !is_string($body['idempotencyKey'] ?? null)) throw new InvalidArgumentException('Find ID and idempotency key required.');
        json_response($engine->world()->claim(current_player_id(), $body['findId'], $body['idempotencyKey']));
    }
    if ($path === '/api/v1/admin/shop-catalog' && $method === 'PUT') {
        $actor = require_admin_mutation(); $body = request_json();
        if (!is_array($body['listings'] ?? null)) throw new InvalidArgumentException('Shop listings must be an array.');
        json_response($engine->saveShopCatalog($body['listings'], \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedRevision'), $actor));
    }
    // A client flag, claimed playerId or copied sandbox ID grants no access.
    if ($path === '/api/v1/admin/playtest' && $method === 'GET') {
        json_response($engine->ownerPlaytest()->status(current_player_id()));
    }
    if ($path === '/api/v1/admin/playtest/start' && $method === 'POST') {
        $actor = require_admin_mutation(); $body = request_json();
        if (array_diff(array_keys($body), ['idempotencyKey']) !== []) throw new InvalidArgumentException('Unknown owner playtest start fields.');
        if (!is_string($body['idempotencyKey'] ?? null)) throw new InvalidArgumentException('An owner playtest idempotency key is required.');
        json_response($engine->ownerPlaytest()->start(current_player_id(), $actor, $body['idempotencyKey'] ?? ''), 201);
    }
    if ($path === '/api/v1/admin/playtest/action' && $method === 'POST') {
        $actor = require_admin_mutation();
        json_response($engine->ownerPlaytest()->act(current_player_id(), $actor, request_json()));
    }
    if ($path === '/api/v1/admin/playtest' && $method === 'DELETE') {
        $actor = require_admin_mutation(); $body = request_json();
        if (array_diff(array_keys($body), ['sessionId', 'idempotencyKey']) !== []) throw new InvalidArgumentException('Unknown owner playtest exit fields.');
        if (!is_string($body['idempotencyKey'] ?? null)) throw new InvalidArgumentException('An owner playtest idempotency key is required.');
        if (!is_string($body['sessionId'] ?? null)) throw new InvalidArgumentException('An owner playtest sessionId is required.');
        json_response($engine->ownerPlaytest()->end(current_player_id(), $actor, $body['sessionId'], $body['idempotencyKey']));
    }
    if ($path === '/api/v1/auth/account' && $method === 'GET') {
        $token = \Zone\Engine\Core\Security\RequestGuard::cookie($_SERVER, \Zone\Engine\Core\Security\BrowserSessions::COOKIE);
        try { json_response($engine->playerAccounts()->status($token)); }
        catch (RuntimeException $error) {
            if ($error->getMessage() !== 'Player session expired.') throw $error;
            json_response(['authenticated' => false, 'claimed' => false]);
        }
    }
    if (in_array($path, ['/api/v1/auth/claim', '/api/v1/auth/login', '/api/v1/auth/recover', '/api/v1/auth/logout'], true) && $method === 'POST') {
        \Zone\Engine\Core\Security\RequestGuard::assertSameOrigin($_SERVER, true, getenv('VERCEL') === '1');
        $token = \Zone\Engine\Core\Security\RequestGuard::cookie($_SERVER, \Zone\Engine\Core\Security\BrowserSessions::COOKIE);
        if ($path === '/api/v1/auth/logout') {
            $engine->browserSessions()->revoke($token);
            zone_cookie(\Zone\Engine\Core\Security\BrowserSessions::COOKIE, '', time() - 3600);
            zone_cookie('zone_player_ledger', '', time() - 3600);
            json_response(['authenticated' => false]);
        }
        $body = request_json();
        foreach (['username', 'password', ...($path === '/api/v1/auth/recover' ? ['recoveryCode'] : [])] as $field) {
            if (!is_string($body[$field] ?? null)) throw new InvalidArgumentException('Account fields must be text.');
        }
        if (strlen($body['username']) > 80) throw new InvalidArgumentException('Username is too long.');
        $account = $engine->playerAccounts();
        $result = match ($path) {
            '/api/v1/auth/claim' => $account->claim($token, $body['username'], $body['password'], zone_client_address()),
            '/api/v1/auth/login' => $account->login($body['username'], $body['password'], zone_client_address(), $token),
            '/api/v1/auth/recover' => $account->recover($body['username'], $body['recoveryCode'], $body['password'], zone_client_address()),
        };
        zone_cookie(\Zone\Engine\Core\Security\BrowserSessions::COOKIE, $result['token'], $result['expiresAt']);
        unset($result['token']);
        json_response($result);
    }
    if ($method === 'POST' && $path === '/api/v1/auth/session') {
        \Zone\Engine\Core\Security\RequestGuard::assertSameOrigin($_SERVER, true, getenv('VERCEL') === '1');
        if (!zone_sessions_enabled()) json_response(['playerId' => current_player_id(), 'mode' => 'local-development']);
        $token = \Zone\Engine\Core\Security\RequestGuard::cookie($_SERVER, \Zone\Engine\Core\Security\BrowserSessions::COOKIE);
        if ($token !== '') json_response(['playerId' => $engine->browserSessions()->resolve($token), 'mode' => 'persistent-browser']);
        $session = $engine->browserSessions()->create(zone_client_address());
        zone_cookie(\Zone\Engine\Core\Security\BrowserSessions::COOKIE, $session['token'], $session['expiresAt']);
        json_response(['playerId' => $session['playerId'], 'mode' => 'persistent-browser', 'expiresAt' => $session['expiresAt']], 201);
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
        json_response(['player' => $engine->player(current_player_id())]);
    }
    if ($method === 'GET' && $path === '/api/v1/leaderboards') {
        json_response($engine->leaderboards(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/gameplay') {
        json_response($engine->gameplay(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/combat') {
        json_response($engine->combat(current_player_id()));
    }
    if ($method === 'GET' && $path === '/api/v1/player-combat') json_response($engine->playerCombat(current_player_id()));
    if ($method === 'GET' && $path === '/api/v1/player-combat/opponents') json_response($engine->playerCombatOpponents(current_player_id()));
    if ($method === 'POST' && $path === '/api/v1/player-combat/action') {
        $body=request_json();
        foreach (['action','opponentId','approach'] as $field) if (isset($body[$field]) && !is_string($body[$field])) throw new InvalidArgumentException('Combat fields must be text.');
        $pid=current_player_id();
        $res=$engine->playerCombatAction($body['action']??'', $body['opponentId']??'', $body['approach']??'', \Zone\Engine\Core\Security\RequestGuard::positiveInt($body,'expectedVersion'),$pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/player-market') json_response($engine->playerMarket(current_player_id()));
    if ($method === 'POST' && $path === '/api/v1/player-market/action') {
        $body=request_json();
        foreach (['action','id'] as $field) if (!is_string($body[$field]??null)) throw new InvalidArgumentException('Market action and ID must be text.');
        $pid=current_player_id();
        $res=$engine->playerMarketAction($body['action'],$body['id'],\Zone\Engine\Core\Security\RequestGuard::positiveInt($body,'quantity'),isset($body['unitPrice'])?\Zone\Engine\Core\Security\RequestGuard::nonNegativeInt($body,'unitPrice'):0,\Zone\Engine\Core\Security\RequestGuard::positiveInt($body,'expectedVersion'),$pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/family-activities') json_response($engine->familyActivities(current_player_id()));
    if ($method === 'POST' && $path === '/api/v1/family-activities/action') {
        $body=request_json();
        foreach (['action','id'] as $field) if (!is_string($body[$field]??null)) throw new InvalidArgumentException('Family action and ID must be text.');
        $pid=current_player_id();
        $res=$engine->familyActivityAction($body['action'],$body['id'],\Zone\Engine\Core\Security\RequestGuard::positiveInt($body,'expectedVersion'),$pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/combat/action') {
        $body = request_json();
        $pid = current_player_id();
        $res = $engine->combatAction((string) ($body['action'] ?? ''), (string) ($body['opponentId'] ?? ''), (string) ($body['approach'] ?? ''), \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion'), $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
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
    if ($method === 'POST' && $path === '/api/v1/factions/join') {
        $body = request_json();
        if (array_diff(array_keys($body), ['factionId']) || !is_string($body['factionId'] ?? null)) throw new InvalidArgumentException('Only a faction ID may be submitted.');
        $pid = current_player_id();
        $res = $engine->joinFaction($body['factionId'], $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res, 201);
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
        // Dashboard summaries must not duplicate whole world snapshots per audit row.
        // Full snapshots stay in storage and are available one record at a time.
        $details = ($_GET['details'] ?? '') === '1';
        $limit = \Zone\Engine\Core\Security\RequestGuard::boundedInt($_GET, 'limit', 1, $details ? 1 : 250, $details ? 1 : 100);
        json_response(['entries' => $engine->adminAuditLog($limit, $details)]);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/admin/gameplay-catalog/([a-z]+)$#', $path, $matches)) {
        $actor = require_admin_mutation();
        $body = request_json();
        if (!is_string($body['id'] ?? null) || !is_array($body['definition'] ?? null) || array_is_list($body['definition'])) throw new InvalidArgumentException('A content ID and definition object are required.');
        json_response($engine->createGameplayCatalog($matches[1], $body['id'], $body['definition'], \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedRevision'), $actor), 201);
    }
    if ($method === 'GET' && $path === '/api/v1/admin/territories') {
        // Owner tooling does not require, create or borrow a browser player session.
        json_response($engine->adminTerritories());
    }
    if ($method === 'PUT' && $path === '/api/v1/admin/draft') {
        $actor = require_admin_mutation();
        $payload = request_json();
        json_response($engine->saveReleaseDraft($payload['manifest'] ?? $payload, $actor, required_draft_fingerprint($payload)));
    }
    if ($method === 'POST' && $path === '/api/v1/admin/releases/publish') {
        $actor = require_admin_mutation();
        $payload = request_json();
        json_response($engine->publishRelease($actor, required_draft_fingerprint($payload)), 201);
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
        $pid = current_player_id();
        $res = $engine->attemptCrime($matches[1], $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && preg_match('#^/api/v1/territories/(ZC-[0-9]{3})/action$#', $path, $matches)) {
        $body = request_json();
        $expectedVersion = \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion');
        $pid = current_player_id();
        $res = $engine->actTerritory($matches[1], (string) ($body['action'] ?? ''), $expectedVersion, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
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
        $pid = current_player_id();
        $res = $engine->trainGym((string) ($body['stat'] ?? ''), $sessions, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/bank/deposit') {
        $body = request_json();
        $pid = current_player_id();
        $res = $engine->bankDeposit(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'amount'), $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/bank/withdraw') {
        $body = request_json();
        $pid = current_player_id();
        $res = $engine->bankWithdraw(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'amount'), $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/hospital/heal') {
        request_json();
        $pid = current_player_id();
        $res = $engine->hospitalHeal($pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/travel') {
        $body = request_json();
        $pid = current_player_id();
        $res = $engine->travel((string) ($body['city'] ?? ''), $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/casino/blackjack') {
        json_response($engine->blackjackState(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/casino/blackjack') {
        $body = request_json();
        $pid = current_player_id();
        $bjAction = isset($body['action']) && is_string($body['action']) ? trim($body['action']) : null;
        $bjBet = ($bjAction === null || $bjAction === '' || $bjAction === 'instant' || $bjAction === 'deal')
            ? \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'bet')
            : \Zone\Engine\Core\Security\RequestGuard::boundedInt($body, 'bet', 100, 10000000, 1000);
        $res = $engine->playBlackjack($bjBet, $pid, $bjAction);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/casino/roulette') {
        json_response($engine->rouletteState(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/casino/roulette') {
        $body = request_json();
        $pid = current_player_id();
        $pocketNumber = array_key_exists('number', $body) && $body['number'] !== null && $body['number'] !== ''
            ? \Zone\Engine\Core\Security\RequestGuard::nonNegativeInt($body, 'number')
            : null;
        $res = $engine->playRoulette(
            \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'bet'),
            (string) ($body['betType'] ?? ''),
            $pocketNumber,
            $pid,
        );
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/casino/slots') {
        json_response($engine->slotsState(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/casino/slots') {
        $body = request_json();
        $pid = current_player_id();
        $res = $engine->playSlots(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'bet'), $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/social') {
        json_response($engine->socialSnapshot(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/social/action') {
        $body = request_json();
        $pid = current_player_id();
        $res = $engine->socialAction($body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
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
        $pid = current_player_id();
        $res = $engine->playHighLow(\Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'bet'), (string) ($body['direction'] ?? ''), \Zone\Engine\Core\Security\RequestGuard::positiveInt($body, 'expectedVersion'), $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/jobs/work') {
        request_json();
        $pid = current_player_id();
        $res = $engine->workShift($pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'POST' && $path === '/api/v1/attack') {
        request_json();
        $pid = current_player_id();
        $res = $engine->attackNpc($pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
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
    if ($method === 'GET' && $path === '/api/v1/hospital/patients') {
        json_response($engine->hospitalPatients(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/hospital/revive-player') {
        $body = request_json();
        $targetPlayerId = (string) ($body['targetPlayerId'] ?? $body['playerId'] ?? $body['id'] ?? '');
        $pid = current_player_id();
        $res = $engine->hospitalRevivePlayer($targetPlayerId, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/player-profile') {
        $targetId = isset($_GET['id']) && is_string($_GET['id']) ? $_GET['id'] : null;
        $query = isset($_GET['q']) && is_string($_GET['q']) ? $_GET['q'] : null;
        json_response($engine->playerProfile(current_player_id(), $targetId, $query));
    }
    if ($path === '/api/v1/player-profile/avatar') {
        if (!in_array($method, ['GET', 'HEAD', 'POST'], true)) {
            json_response(['error' => 'Method not allowed.'], 405);
        }
        try {
            if ($method === 'GET' || $method === 'HEAD') {
                $requestedId = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';
                $targetPlayerId = $requestedId !== '' ? $requestedId : current_player_id();
                if (($_GET['raw'] ?? '') === '1') {
                    $rawAvatar = $engine->playerAvatar()->rawBinary($targetPlayerId);
                    if ($rawAvatar !== null) {
                        http_response_code(200);
                        header('Content-Type: ' . $rawAvatar['mimeType']);
                        header('Content-Length: ' . strlen($rawAvatar['bytes']));
                        header('X-Content-Type-Options: nosniff');
                        header('Cache-Control: public, max-age=3600');
                        if ($method !== 'HEAD') {
                            echo $rawAvatar['bytes'];
                        }
                        exit;
                    }
                }
                json_response($engine->playerAvatarState($targetPlayerId, $targetPlayerId));
            }
            $body = request_json();
            if (!is_string($body['action'] ?? null)) {
                throw new InvalidArgumentException('Avatar action must be text.');
            }
            $pid = current_player_id();
            $res = $engine->playerAvatarAction($body['action'], $body, $pid);
            $engine->syncEphemeralLedger($pid);
            json_response($res);
        } catch (InvalidArgumentException $avatarError) {
            json_response(['ok' => false, 'error' => $avatarError->getMessage(), 'type' => $avatarError::class], 400);
        }
    }
    if ($method === 'GET' && $path === '/api/v1/events-feed') {
        $limit = \Zone\Engine\Core\Security\RequestGuard::boundedInt($_GET, 'limit', 1, 40, 40);
        json_response($engine->eventsFeed(current_player_id(), $limit));
    }
    if ($method === 'GET' && $path === '/api/v1/foreign-market') {
        json_response($engine->foreignMarket(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/foreign-market/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Foreign market action must be text.');
        $pid = current_player_id();
        $res = $engine->foreignMarketAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/faction-chain') {
        json_response($engine->factionChain(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/faction-chain/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Faction chain action must be text.');
        $pid = current_player_id();
        $res = $engine->factionChainAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/story-campaign') {
        json_response($engine->storyCampaign(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/story-campaign/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Story campaign action must be text.');
        $pid = current_player_id();
        $res = $engine->storyCampaignAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/player-rpg') {
        json_response($engine->playerRpg(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/player-rpg/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Player RPG action must be text.');
        $pid = current_player_id();
        $res = $engine->playerRpgAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/city-activities') {
        json_response($engine->cityActivities(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/city-activities/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('City activities action must be text.');
        $pid = current_player_id();
        $res = $engine->cityActivitiesAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/syndicate-economy') {
        json_response($engine->syndicateEconomy(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/syndicate-economy/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Syndicate economy action must be text.');
        $pid = current_player_id();
        $res = $engine->syndicateEconomyAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/faction-empire') {
        json_response($engine->factionEmpire(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/faction-empire/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Faction empire action must be text.');
        $pid = current_player_id();
        $res = $engine->factionEmpireAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/ascension') {
        json_response($engine->ascension(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/ascension/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Ascension action must be text.');
        $pid = current_player_id();
        $res = $engine->ascensionAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/tactical') {
        $district = isset($_GET['district']) && is_string($_GET['district']) && trim($_GET['district']) !== ''
            ? trim($_GET['district'])
            : 'pier_4';
        json_response($engine->tactical(current_player_id(), $district));
    }
    if ($method === 'POST' && $path === '/api/v1/tactical/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Tactical action must be text.');
        $pid = current_player_id();
        $res = $engine->tacticalAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/economy-security') {
        json_response($engine->economySecurity(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/economy-security/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Economy security action must be text.');
        $pid = current_player_id();
        $res = $engine->economySecurityAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/faction-war') {
        $sinceSeq = isset($_GET['sinceSeq']) && is_numeric($_GET['sinceSeq']) ? (int) $_GET['sinceSeq'] : null;
        $district = isset($_GET['district']) && is_string($_GET['district']) && trim($_GET['district']) !== ''
            ? trim($_GET['district'])
            : 'center';
        json_response($engine->factionWar(current_player_id(), $sinceSeq, $district));
    }
    if ($method === 'POST' && $path === '/api/v1/faction-war/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Faction war action must be text.');
        $pid = current_player_id();
        $res = $engine->factionWarAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/synergies') {
        json_response($engine->synergies(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/synergies/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Synergy action must be text.');
        $pid = current_player_id();
        $res = $engine->synergiesAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/settings') {
        json_response($engine->playerSettings(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/settings/action') {
        $body = request_json();
        $action = is_string($body['action'] ?? null) && trim($body['action']) !== '' ? trim($body['action']) : 'settings.save';
        $pid = current_player_id();
        $res = $engine->playerSettingsAction($action, $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && ($path === '/api/v1/syndicate-chat' || $path === '/api/v1/chat')) {
        $channel = isset($_GET['channel']) && is_string($_GET['channel']) && trim($_GET['channel']) !== '' ? trim($_GET['channel']) : 'global';
        $sinceId = isset($_GET['sinceId']) && is_numeric($_GET['sinceId']) ? (int) $_GET['sinceId'] : null;
        $district = isset($_GET['district']) && is_string($_GET['district']) && trim($_GET['district']) !== '' ? trim($_GET['district']) : 'center';
        json_response($engine->syndicateChat(current_player_id(), $channel, $sinceId, $district));
    }
    if ($method === 'POST' && ($path === '/api/v1/syndicate-chat/action' || $path === '/api/v1/chat/action')) {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Chat action must be text.');
        $pid = current_player_id();
        $res = $engine->syndicateChatAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
    }
    if ($method === 'GET' && $path === '/api/v1/companions') {
        json_response($engine->companions(current_player_id()));
    }
    if ($method === 'POST' && $path === '/api/v1/companions/action') {
        $body = request_json();
        if (!is_string($body['action'] ?? null)) throw new InvalidArgumentException('Companion action must be text.');
        $pid = current_player_id();
        $res = $engine->companionsAction($body['action'], $body, $pid);
        $engine->syncEphemeralLedger($pid);
        json_response($res);
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
        $message === 'Player session expired.' => 401,
        $message === 'Invalid account credentials.' => 401,
        $message === 'Account is already claimed.' || $message === 'Username is unavailable.' => 409,
        $message === 'Too many account attempts. Try again in 15 minutes.' => 429,
        $message === 'Too many new beta accounts. Try again later.' => 429,
        str_starts_with($message, 'Territory state changed.') => 409,
        str_starts_with($message, 'Casino round changed.') => 409,
        str_starts_with($message, 'Gameplay state changed.') => 409,
        str_starts_with($message, 'Owner playtest state changed.') || str_starts_with($message, 'Owner playtest idempotency') || str_starts_with($message, 'Owner playtest is already active.') => 409,
        str_starts_with($message, 'Gameplay catalog changed.') => 409,
        str_starts_with($message, 'Release draft changed.') => 409,
        str_starts_with($message, 'Progression state changed.') => 409,
        str_starts_with($message, 'The market price changed.') => 409,
        str_starts_with($message, 'Combat state changed.') => 409,
        str_starts_with($message, 'Listing state changed.') => 409,
        str_starts_with($message, 'Listing is no longer available.') => 409,
        str_starts_with($message, 'Operation changed.') => 409,
        str_starts_with($message, 'Operation roster changed.') => 409,
        str_starts_with($message, 'Operation creator changed.') => 409,
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

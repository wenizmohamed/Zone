<?php

declare(strict_types=1);

$rewrittenPath = $_GET['__zone_path'] ?? null;
if (is_string($rewrittenPath) && str_starts_with($rewrittenPath, '/')) {
    $_SERVER['REQUEST_URI'] = $rewrittenPath;
    unset($_GET['__zone_path']);
}

/** Relay mode never initializes or opens a database inside the Vercel function. */
function zone_proxy_error(string $message, int $status): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => $message], JSON_THROW_ON_ERROR);
    exit;
}

function zone_proxy_public_path(string $path): bool
{
    if (preg_match('~^/api/v1/assets/[a-f0-9]{64}(?:/content)?$~D', $path) || in_array($path, ['/api/v1/world', '/api/v1/world/claim'], true)) return true;
    if ($path === '/engine/theme.css') return true;
    if (!preg_match('~^/api/v1/[A-Za-z0-9/-]+$~D', $path) || str_contains($path, '//') || str_ends_with($path, '/')) return false;
    $route = substr($path, strlen('/api/v1/'));
    return in_array($route, ['auth/account', 'auth/claim', 'auth/login', 'auth/recover', 'auth/logout', 'auth/session',
        'health', 'engine', 'modules', 'themes', 'player', 'leaderboards', 'gameplay', 'gameplay/action', 'combat', 'combat/action',
        'player-combat', 'player-combat/opponents', 'player-combat/action', 'player-market', 'player-market/action',
        'family-activities', 'family-activities/action', 'crimes', 'achievements', 'city/map', 'factions/join', 'releases/active',
        'game/bootstrap', 'cities', 'gym/train', 'bank/deposit', 'bank/withdraw', 'hospital/heal', 'hospital/quote', 'travel',
        'casino/blackjack', 'casino/high-low', 'jobs/work', 'attack', 'daily/login', 'daily/contract', 'daily/contract/claim', 'notifications'], true)
        || preg_match('~^(?:crimes/[a-z0-9-]+/attempt|territories/ZC-[0-9]{3}/action)$~D', $route) === 1;
}

/** Explicit owner routes still require the engine's signed owner session. */
function zone_proxy_owner_methods(string $path): array
{
    // Public media reads may carry a signed owner proof for draft inspection.
    // Without that proof the engine exposes only assets in the active release.
    if (preg_match('~^/api/v1/assets/[a-f0-9]{64}(?:/content)?$~D', $path) || in_array($path, ['/api/v1/admin/assets', '/api/v1/admin/workers'], true) || preg_match('~^/api/v1/admin/assets/[a-f0-9]{64}$~D', $path)) return ['GET', 'HEAD'];
    if ($path === '/api/v1/admin/assets/uploads' || preg_match('~^/api/v1/admin/assets/uploads/[a-f0-9]{32}/(?:chunks|complete)$~D', $path)) return ['POST'];
    if ($path === '/api/v1/admin/shop-catalog' || preg_match('~^/api/v1/admin/assets/[a-f0-9]{64}/transform$~D', $path)) return ['PUT'];
    if (in_array($path, ['/engine', '/engine/', '/engine/assets/engine.css', '/engine/assets/engine.js', '/api/v1/ledger', '/api/v1/events', '/api/v1/architecture'], true)) return ['GET', 'HEAD'];
    if ($path === '/api/v1/admin/session') return ['GET', 'POST', 'DELETE'];
    if ($path === '/api/v1/admin/playtest') return ['GET', 'DELETE'];
    if (in_array($path, ['/api/v1/admin/playtest/start', '/api/v1/admin/playtest/action'], true)) return ['POST'];
    if ($path === '/api/v1/admin/draft') return ['GET', 'PUT'];
    if (in_array($path, ['/api/v1/admin/releases', '/api/v1/admin/crimes', '/api/v1/admin/audit', '/api/v1/admin/territories', '/api/v1/admin/gameplay-catalog'], true)) return ['GET'];
    if (preg_match('~^/api/v1/admin/(?:crimes/[a-z0-9-]+|gameplay-catalog/[a-z]+/[A-Za-z0-9_-]+)$~D', $path)) return ['PUT'];
    if ($path === '/api/v1/admin/releases/publish' || preg_match('~^/api/v1/admin/(?:releases/[a-f0-9]{32}/activate|modules/[a-z0-9-]+/(?:install|uninstall|enable|disable)|themes/[a-z0-9-]+/activate|territories/ZC-[0-9]{3}/ownership|gameplay-catalog/[a-z]+)$~D', $path)) return ['POST'];
    return [];
}

function zone_proxy_host(string $value): ?string
{
    $value = strtolower($value);
    if (!preg_match('~^(?:localhost|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::443)?$~D', $value) || str_contains($value, '..')) return null;
    return preg_replace('~:443$~', '', $value);
}

/** Owner credentials stay in Vercel. The local engine receives only a signed proof. */
function zone_proxy_owner_access(): array
{
    require_once dirname(__DIR__) . '/engine/src/Core/Security/RequestGuard.php';
    // Explicit tester-beta switch. Removing it restores the existing owner login.
    if (getenv('ZONE_BETA_OWNER_ACCESS') === '1') {
        return ['configured' => true, 'authenticated' => true, 'localDevelopment' => false,
            'credentialMode' => 'beta', 'betaTesting' => true];
    }
    $token = trim((string) (getenv('ZONE_ADMIN_TOKEN') ?: ''));
    $username = trim((string) (getenv('ZONE_ADMIN_USERNAME') ?: ''));
    $hash = trim((string) (getenv('ZONE_ADMIN_PASSWORD_HASH') ?: ''));
    $secret = $token ?: trim((string) (getenv('ZONE_ADMIN_SESSION_SECRET') ?: ''));
    $configured = $token !== '' || ($username !== '' && (password_get_info($hash)['algo'] ?? null) !== null && strlen($secret) >= 32);
    $cookie = \Zone\Engine\Core\Security\RequestGuard::cookie($_SERVER, 'zone_admin_session');
    return ['configured' => $configured, 'authenticated' => $configured && \Zone\Engine\Core\Security\RequestGuard::validAdminSession($cookie, $secret),
        'localDevelopment' => false, 'credentialMode' => $token !== '' ? 'token' : 'password'];
}
function zone_proxy_json(array $data): never
{
    header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_THROW_ON_ERROR); exit;
}

$relayOrigin = trim((string) (getenv('ZONE_ENGINE_ORIGIN') ?: ''));
$relayKey = (string) (getenv('ZONE_ENGINE_RELAY_KEY') ?: '');
if (getenv('VERCEL') === '1' && str_contains($relayOrigin, 'social.aihubz.me')) {
    $relayOrigin = '';
    $relayKey = '';
    putenv('ZONE_DATABASE_URL=sqlite:' . rtrim(sys_get_temp_dir(), '/\\') . '/zone-engine.sqlite');
}
if ($relayOrigin !== '' || $relayKey !== '') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!is_string($path)) zone_proxy_error('Route not found.', 404);
    $ownerMethods = zone_proxy_owner_methods($path);
    if (!zone_proxy_public_path($path) && $ownerMethods === []) zone_proxy_error('Route not found.', 404);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($method, $ownerMethods ?: ['GET', 'HEAD', 'POST', 'OPTIONS'], true)) zone_proxy_error('Method not allowed.', 405);
    if ($path === '/engine/theme.css' && !in_array($method, ['GET', 'HEAD'], true)) zone_proxy_error('Theme stylesheet is read-only.', 405);
    $origin = parse_url($relayOrigin);
    if (!is_array($origin) || ($origin['scheme'] ?? '') !== 'https' || empty($origin['host'])
        || isset($origin['user']) || isset($origin['pass'])
        || isset($origin['query']) || isset($origin['fragment'])
        || !preg_match('~^/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]*$~D', $origin['path'] ?? '/')
        || !preg_match('~^[A-Za-z0-9.-]+$~D', $origin['host'])
        || !preg_match('/^[\x21-\x7e]{32,512}$/D', $relayKey)
        || !extension_loaded('openssl')) zone_proxy_error('Engine relay configuration is unavailable.', 503);
    $publicHosts = array_map('zone_proxy_host', explode(',', (string) (getenv('ZONE_ENGINE_PUBLIC_HOSTS') ?: '')));
    $host = zone_proxy_host((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === null || !in_array($host, $publicHosts, true)) zone_proxy_error('Invalid public host.', 403);
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    // Vercel overwrites these provider headers. Local entry points trust only their socket peer.
    if (getenv('VERCEL') === '1') {
        $providerIP = $_SERVER['HTTP_X_VERCEL_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? '';
        if (filter_var($providerIP, FILTER_VALIDATE_IP)) $ip = $providerIP;
    }
    if (!filter_var($ip, FILTER_VALIDATE_IP)) zone_proxy_error('Invalid client address.', 403);
    $requestOrigin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (in_array($method, ['POST', 'PUT', 'DELETE'], true) && $requestOrigin !== 'https://' . $host) zone_proxy_error('Cross-origin request rejected.', 403);
    // Whole release manifests include the catalog; ordinary actions remain capped at 64 KB.
    $largeDraft = $method === 'PUT' && in_array($path, ['/api/v1/admin/draft', '/api/v1/admin/shop-catalog'], true);
    $assetChunk = $method === 'POST' && preg_match('~^/api/v1/admin/assets/uploads/[a-f0-9]{32}/chunks$~D', $path);
    $requestLimit = $largeDraft || $assetChunk ? 1048576 : 65536;
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $requestLimit) zone_proxy_error('Request body is too large.', 413);
    $body = file_get_contents('php://input', false, null, 0, $requestLimit + 1);
    if ($body === false || strlen($body) > $requestLimit) zone_proxy_error('Request body is too large.', 413);
    $ownerAccess = zone_proxy_owner_access();
    if ($path === '/api/v1/admin/session' && ($ownerAccess['betaTesting'] ?? false)) zone_proxy_json($ownerAccess);
    if ($path === '/api/v1/admin/session' && $ownerAccess['configured']) {
        if ($method === 'GET') zone_proxy_json($ownerAccess);
        $secret = trim((string) (getenv('ZONE_ADMIN_TOKEN') ?: getenv('ZONE_ADMIN_SESSION_SECRET') ?: ''));
        if ($method === 'POST') {
            $credentials = json_decode($body, true);
            $valid = is_array($credentials) && ($ownerAccess['credentialMode'] === 'token'
                ? (is_string($credentials['token'] ?? null) && hash_equals($secret, $credentials['token']))
                : (is_string($credentials['username'] ?? null) && is_string($credentials['password'] ?? null) && strlen($credentials['password']) <= 1024
                    && password_verify($credentials['password'], trim((string) getenv('ZONE_ADMIN_PASSWORD_HASH')))
                    && hash_equals(trim((string) getenv('ZONE_ADMIN_USERNAME')), $credentials['username'])));
            if (!$valid) zone_proxy_error('Admin authentication required.', 401);
            $cookie = \Zone\Engine\Core\Security\RequestGuard::adminSession($secret); $expires = time() + 43200;
            $ownerAccess['authenticated'] = true;
        } else { $cookie = ''; $expires = time() - 3600; $ownerAccess['authenticated'] = false; }
        setcookie('zone_admin_session', $cookie, ['expires' => $expires, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
        zone_proxy_json($ownerAccess);
    }
    if (in_array($path, ['/engine', '/engine/'], true) && $ownerAccess['configured'] && !$ownerAccess['authenticated']) {
        header('Cache-Control: no-store'); header('Location: /admin?lang=' . (($_GET['lang'] ?? '') === 'ar' ? 'ar' : 'en'), true, 302); exit;
    }
    $headers = ['X-Zone-Relay-Key: ' . $relayKey, 'X-Zone-Client-Host: ' . $host, 'X-Zone-Client-Proto: https', 'X-Zone-Client-IP: ' . $ip];
    foreach (['HTTP_ACCEPT' => 'Accept', 'CONTENT_TYPE' => 'Content-Type', 'HTTP_ORIGIN' => 'Origin', 'HTTP_REFERER' => 'Referer', 'HTTP_USER_AGENT' => 'User-Agent', 'HTTP_X_ZONE_PLAYER_ID' => 'X-Zone-Player-ID', 'HTTP_X_ZONE_PLAYER_TOKEN' => 'X-Zone-Player-Token'] as $input => $name) {
        $value = $_SERVER[$input] ?? '';
        if (is_string($value) && $value !== '' && !preg_match('/[\r\n\x00]/', $value)) $headers[] = $name . ': ' . $value;
    }
    $cookieNames = $ownerMethods === [] ? ['zone_player_session'] : ['zone_player_session', 'zone_admin_session'];
    $cookies = array_filter(explode(';', (string) ($_SERVER['HTTP_COOKIE'] ?? '')), static fn ($part) => in_array(explode('=', trim($part), 2)[0], $cookieNames, true));
    if ($cookies !== []) $headers[] = 'Cookie: ' . implode(';', $cookies);
    $query = http_build_query($_GET, '', '&', PHP_QUERY_RFC3986);
    $requestTarget = $path . ($query === '' ? '' : '?' . $query);
    if ($ownerMethods !== [] && $ownerAccess['authenticated']) {
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', "owner-gateway:\n" . $method . "\n" . $requestTarget . "\n" . hash('sha256', $body) . "\n" . $timestamp, $relayKey);
        $headers[] = 'X-Zone-Owner-Proof: ' . $timestamp . '.' . $signature;
    }
    $destination = rtrim($relayOrigin, '/') . $requestTarget;
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body,
        'timeout' => 22, 'ignore_errors' => true, 'follow_location' => 0, 'max_redirects' => 0, 'protocol_version' => 1.1],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false]]);
    // A single network attempt, including writes. An interrupted response must never replay an action.
    $stream = @fopen($destination, 'rb', false, $context);
    if ($stream === false) zone_proxy_error('Local engine is unavailable. Reload saved state before repeating an action.', 503);
    $raw = stream_get_contents($stream, 4194305); $metadata = stream_get_meta_data($stream); fclose($stream);
    if ($raw === false || strlen($raw) > 4194304 || ($metadata['timed_out'] ?? false)) zone_proxy_error('Local engine response is unavailable. Reload saved state before repeating an action.', 503);
    $responseHeaders = $metadata['wrapper_data'] ?? []; $status = null; $responseLength = null;
    foreach ($responseHeaders as $line) {
        if (preg_match('~^HTTP/\S+ ([1-5][0-9]{2})\b~', $line, $match)) { $status = (int) $match[1]; $responseLength = null; }
        elseif (preg_match('~^Content-Length:\s*([0-9]+)\s*$~iD', $line, $match)) $responseLength = (int) $match[1];
    }
    if ($status === null) zone_proxy_error('Engine relay response is invalid.', 502);
    if ($method !== 'HEAD' && $responseLength !== null && strlen($raw) !== $responseLength) zone_proxy_error('Local engine response was interrupted. Reload saved state before repeating an action.', 503);
    http_response_code($status); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
    foreach ($responseHeaders as $line) {
        $parts = explode(':', $line, 2); if (count($parts) !== 2) continue;
        [$name, $value] = $parts; $name = strtolower(trim($name)); $value = trim($value);
        if (preg_match('/[\r\n\x00]/', $value)) continue;
        if (in_array($name, ['content-type', 'retry-after', 'content-security-policy', 'referrer-policy', 'permissions-policy'], true)) header($name . ': ' . $value);
        elseif ($name === 'set-cookie' && (str_starts_with($value, 'zone_player_session=') || ($path === '/api/v1/admin/session' && str_starts_with($value, 'zone_admin_session=')))) {
            $parts = array_filter(explode(';', $value), static fn ($part) => !preg_match('/^\s*(?:domain|secure|httponly|samesite)\b/i', $part));
            header('Set-Cookie: ' . implode(';', [...$parts, 'Secure', 'HttpOnly', 'SameSite=Strict']), false);
        } elseif ($name === 'location' && zone_proxy_public_path($value)) header('Location: ' . $value);
    }
    if ($method !== 'HEAD') echo $raw;
    exit;
}

if (getenv('VERCEL') === '1' && !getenv('ZONE_DATABASE_URL')) {
    $databaseUrl = getenv('DATABASE_URL') ?: getenv('POSTGRES_URL') ?: '';
    if ($databaseUrl !== '') {
        putenv('ZONE_DATABASE_URL=' . $databaseUrl);
    }
}
if (getenv('VERCEL') === '1' && !getenv('ZONE_PLAYER_SESSIONS')) {
    putenv('ZONE_PLAYER_SESSIONS=1');
}

require dirname(__DIR__) . '/engine/router.php';

<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Security;

use InvalidArgumentException;
use RuntimeException;

/**
 * Server-authoritative request guard.
 *
 * Centralises the authorization decisions that used to live inline in the
 * router so they are unit-testable and identical across every route:
 *   - admin mutation routes require a real token (production) or a strict
 *     same-origin check that no longer grants a free pass to header-less
 *     clients (demo);
 *   - the acting player identity is resolved server-side, never blindly
 *     trusted from a client-supplied header.
 *
 * Every method is pure over the $server array it receives, so the test suite
 * can exercise each policy without an HTTP round-trip.
 */
final class RequestGuard
{
    public const ADMIN_COOKIE = 'zone_admin_session';
    /** Canonical player-id shape: lowercase, digits and hyphens, 3-64 chars. */
    public const PLAYER_ID_PATTERN = '/^[a-z0-9][a-z0-9-]{2,63}$/';

    public const DEFAULT_DEMO_PLAYER = 'founder-player';

    /**
     * Authorize an admin/mutation request. Returns the actor label to record
     * in the audit trail, or throws when the caller is not authorized.
     *
     * @param array<string, mixed> $server  Typically $_SERVER.
     * @param string|null          $adminToken  Configured ZONE_ADMIN_TOKEN, or null in demo mode.
     */
    public static function authorizeAdmin(array $server, ?string $adminToken, bool $trustForwardedProto = false): string
    {
        $adminToken = $adminToken !== null ? trim($adminToken) : null;

        if ($adminToken !== null && $adminToken !== '') {
            $provided = trim((string) ($server['HTTP_X_ZONE_ADMIN_TOKEN'] ?? ''));
            if (self::validAdminSession(self::cookie($server, self::ADMIN_COOKIE), $adminToken)) return 'admin-session';
            if ($provided === '' || !hash_equals($adminToken, $provided)) {
                throw new RuntimeException('Admin authentication required.');
            }
            return 'admin-token';
        }

        // Demo mode: no token configured. A state-changing request MUST carry a
        // matching same-origin header. This closes the previous hole where any
        // header-less client (curl, a bot, server-to-server) was waved through.
        self::assertSameOrigin($server, true, $trustForwardedProto);
        return 'admin-panel';
    }

    /**
     * Same-origin (CSRF) check. When $requirePresent is true a missing/empty
     * Origin header is treated as a failure rather than a free pass.
     *
     * @param array<string, mixed> $server
     */
    public static function assertSameOrigin(array $server, bool $requirePresent, bool $trustForwardedProto = false): void
    {
        $origin = trim((string) ($server['HTTP_ORIGIN'] ?? ''));
        if ($origin === '') {
            if ($requirePresent) {
                throw new RuntimeException('Admin authentication required.');
            }
            return;
        }
        $https = strtolower((string) ($server['HTTPS'] ?? ''));
        $scheme = ($https !== '' && $https !== 'off' && $https !== '0') || ($server['REQUEST_SCHEME'] ?? '') === 'https' ? 'https' : 'http';
        // Only the deployment entry point may opt into the trusted Vercel
        // proxy contract. A client-supplied forwarding header on localhost or
        // a direct PHP server never changes the transport used by this check.
        if ($trustForwardedProto && isset($server['HTTP_X_FORWARDED_PROTO'])) {
            $forwarded = trim(explode(',', (string) $server['HTTP_X_FORWARDED_PROTO'])[0] ?? '');
            if ($forwarded !== '') {
                $scheme = strtolower($forwarded);
            }
        }
        $originParts = self::originParts($origin);
        $requestParts = self::originParts($scheme . '://' . trim((string) ($server['HTTP_HOST'] ?? '')));
        if ($originParts === null || $requestParts === null || $originParts !== $requestParts) {
            throw new RuntimeException('Cross-origin admin request rejected.');
        }
    }

    public static function cookie(array $server, string $name): string
    {
        foreach (explode(';', (string) ($server['HTTP_COOKIE'] ?? '')) as $part) {
            $pair = explode('=', trim($part), 2);
            if (($pair[0] ?? '') === $name) return rawurldecode($pair[1] ?? '');
        }
        return '';
    }

    public static function adminSession(string $secret, ?int $now = null): string
    {
        $payload = (string) (($now ?? time()) + 43200) . '.' . bin2hex(random_bytes(16));
        return $payload . '.' . hash_hmac('sha256', 'admin-session:' . $payload, $secret);
    }

    public static function validAdminSession(string $cookie, string $secret, ?int $now = null): bool
    {
        if (!preg_match('/^([0-9]{10,11})\.([a-f0-9]{32})\.([a-f0-9]{64})$/', $cookie, $match)) return false;
        $now ??= time();
        if ((int) $match[1] <= $now || (int) $match[1] > $now + 43200) return false;
        return hash_equals(hash_hmac('sha256', 'admin-session:' . $match[1] . '.' . $match[2], $secret), $match[3]);
    }

    public static function ledgerSecret(): string
    {
        $secret = trim((string) (getenv('ZONE_LEDGER_SECRET') ?: getenv('ZONE_ADMIN_SESSION_SECRET') ?: getenv('ZONE_ADMIN_TOKEN') ?: ''));
        return strlen($secret) >= 16 ? $secret : '';
    }

    /** @return array{string, string, int}|null */
    private static function originParts(string $url): ?array
    {
        if (preg_match('/[\s\\\\]/', $url)) {
            return null;
        }
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['path']) || isset($parts['query']) || isset($parts['fragment'])) {
            return null;
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true)) {
            return null;
        }
        return [$scheme, strtolower($parts['host']), (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80))];
    }

    /**
     * Resolve the acting player id, server-authoritatively.
     *
     * Demo mode (no player secret configured): identity is pinned to the demo
     * player. A client that tries to assume any other identity is rejected, so
     * the X-Zone-Player-Id header can never be used to act as / read another
     * player's account.
     *
     * Production mode (ZONE_PLAYER_AUTH set): the client must present a valid
     * HMAC token (X-Zone-Player-Token) that binds the claimed id to the shared
     * secret. Without the secret an attacker cannot forge a token for a victim.
     *
     * @param array<string, mixed> $server
     */
    public static function resolvePlayerId(
        array $server,
        ?string $playerSecret,
        string $demoPlayer = self::DEFAULT_DEMO_PLAYER,
    ): string {
        $claimed = trim((string) ($server['HTTP_X_ZONE_PLAYER_ID'] ?? ''));
        $playerSecret = $playerSecret !== null ? trim($playerSecret) : null;

        if ($playerSecret === null || $playerSecret === '') {
            if ($claimed === '' || $claimed === $demoPlayer) {
                return $demoPlayer;
            }
            throw new RuntimeException('Player authentication required to act as another player.');
        }

        if ($claimed === '') {
            throw new RuntimeException('Player identity header is required.');
        }
        if (!preg_match(self::PLAYER_ID_PATTERN, $claimed)) {
            throw new InvalidArgumentException('Invalid player identifier format.');
        }
        $token = trim((string) ($server['HTTP_X_ZONE_PLAYER_TOKEN'] ?? ''));
        if ($token === '' || !hash_equals(self::signPlayer($claimed, $playerSecret), $token)) {
            throw new RuntimeException('Player authentication failed.');
        }
        return $claimed;
    }

    /** Deterministic player token used by the production auth path. */
    public static function signPlayer(string $playerId, string $secret): string
    {
        return hash_hmac('sha256', $playerId, $secret);
    }

    /**
     * Strict positive-integer field extractor for request bodies. Rejects
     * missing, non-numeric, fractional, zero and negative values instead of
     * silently casting them to 0.
     *
     * @param array<string, mixed> $body
     */
    public static function positiveInt(array $body, string $key): int
    {
        $value = $body[$key] ?? null;
        $number = self::coerceInt($value);
        if ($number === null) {
            throw new InvalidArgumentException("The '{$key}' field must be a whole number.");
        }
        if ($number <= 0) {
            throw new InvalidArgumentException("The '{$key}' field must be greater than zero.");
        }
        return $number;
    }

    /** Strict quoted-price input: zero is valid, negative/fractional values are not. */
    public static function nonNegativeInt(array $body, string $key): int
    {
        $number = self::coerceInt($body[$key] ?? null);
        if ($number === null || $number < 0) {
            throw new InvalidArgumentException("The '{$key}' field must be a nonnegative whole number.");
        }
        return $number;
    }

    /**
     * Bounded-integer field extractor. Missing/empty falls back to $default;
     * present-but-invalid is rejected; valid values are clamped to [$min,$max].
     *
     * @param array<string, mixed> $body
     */
    public static function boundedInt(array $body, string $key, int $min, int $max, int $default): int
    {
        if (!array_key_exists($key, $body) || $body[$key] === null || $body[$key] === '') {
            return $default;
        }
        $number = self::coerceInt($body[$key]);
        if ($number === null) {
            throw new InvalidArgumentException("The '{$key}' field must be a whole number.");
        }
        return max($min, min($max, $number));
    }

    private static function coerceInt(mixed $value): ?int
    {
        if (is_bool($value) || $value === null) {
            return null;
        }
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value)) {
            return floor($value) === $value ? (int) $value : null;
        }
        if (is_string($value) && preg_match('/^-?\d+$/', trim($value)) === 1) {
            return (int) trim($value);
        }
        return null;
    }

    public static function isValidPlayerId(string $playerId): bool
    {
        return preg_match(self::PLAYER_ID_PATTERN, $playerId) === 1;
    }

    public static function isAdminSessionExpired(string $cookie, ?int $now = null): bool
    {
        if (!preg_match('/^([0-9]{10,11})\.[a-f0-9]{32}\.[a-f0-9]{64}$/', $cookie, $match)) {
            return true;
        }
        return (int) $match[1] <= ($now ?? time());
    }
}

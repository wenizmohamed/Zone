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
    public static function authorizeAdmin(array $server, ?string $adminToken): string
    {
        $adminToken = $adminToken !== null ? trim($adminToken) : null;

        if ($adminToken !== null && $adminToken !== '') {
            $provided = trim((string) ($server['HTTP_X_ZONE_ADMIN_TOKEN'] ?? ''));
            if ($provided === '' || !hash_equals($adminToken, $provided)) {
                throw new RuntimeException('Admin authentication required.');
            }
            return 'admin-token';
        }

        // Demo mode: no token configured. A state-changing request MUST carry a
        // matching same-origin header. This closes the previous hole where any
        // header-less client (curl, a bot, server-to-server) was waved through.
        self::assertSameOrigin($server, true);
        return 'admin-panel';
    }

    /**
     * Same-origin (CSRF) check. When $requirePresent is true a missing/empty
     * Origin header is treated as a failure rather than a free pass.
     *
     * @param array<string, mixed> $server
     */
    public static function assertSameOrigin(array $server, bool $requirePresent): void
    {
        $origin = trim((string) ($server['HTTP_ORIGIN'] ?? ''));
        if ($origin === '') {
            if ($requirePresent) {
                throw new RuntimeException('Admin authentication required.');
            }
            return;
        }
        $originHost = parse_url($origin, PHP_URL_HOST);
        $requestHost = explode(':', (string) ($server['HTTP_HOST'] ?? ''))[0];
        if (!is_string($originHost) || $originHost === '' || !hash_equals(strtolower($requestHost), strtolower($originHost))) {
            throw new RuntimeException('Cross-origin admin request rejected.');
        }
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
}

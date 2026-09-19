<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Security;

use RuntimeException;

final class AdminSession
{
    private const PRODUCTION_COOKIE = '__Host-zone_admin';
    private const LOCAL_COOKIE = 'zone_admin';
    private const SESSION_TTL = 28800;

    public static function credentialsConfigured(): bool
    {
        return self::username() !== ''
            && self::passwordHash() !== ''
            && strlen(self::secret()) >= 32;
    }

    public static function login(string $username, string $password): ?array
    {
        self::assertConfigured();

        if (!hash_equals(self::username(), trim($username)) || !password_verify($password, self::passwordHash())) {
            return null;
        }

        $session = [
            'username' => self::username(),
            'role' => 'owner',
            'csrf' => bin2hex(random_bytes(24)),
            'iat' => time(),
            'exp' => time() + self::SESSION_TTL,
        ];
        self::writeCookie(self::encode($session), $session['exp']);
        return self::publicSession($session);
    }

    public static function current(): ?array
    {
        $token = $_COOKIE[self::cookieName()] ?? '';
        if (!is_string($token) || $token === '') {
            return null;
        }

        $session = self::decode($token);
        if ($session === null || ($session['exp'] ?? 0) < time()) {
            self::clearCookie();
            return null;
        }

        return $session;
    }

    public static function publicCurrent(): array
    {
        $session = self::current();
        if ($session === null) {
            return ['authenticated' => false];
        }

        return self::publicSession($session);
    }

    public static function requireAuthenticated(): array
    {
        self::assertConfigured();
        $session = self::current();
        if ($session === null) {
            throw new RuntimeException('Admin authentication required.');
        }

        return $session;
    }

    public static function requireCsrf(array $session, string $provided): void
    {
        $expected = (string) ($session['csrf'] ?? '');
        if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
            throw new RuntimeException('Invalid admin CSRF token.');
        }
    }

    public static function logout(): void
    {
        self::clearCookie();
    }

    public static function issueTokenForTest(string $username, int $expiresAt, string $csrf = 'test-csrf'): string
    {
        self::assertConfigured();
        return self::encode([
            'username' => $username,
            'role' => 'owner',
            'csrf' => $csrf,
            'iat' => time(),
            'exp' => $expiresAt,
        ]);
    }

    public static function decodeTokenForTest(string $token): ?array
    {
        return self::decode($token);
    }

    private static function publicSession(array $session): array
    {
        return [
            'authenticated' => true,
            'user' => [
                'username' => (string) $session['username'],
                'role' => (string) $session['role'],
            ],
            'csrfToken' => (string) $session['csrf'],
            'expiresAt' => gmdate('c', (int) $session['exp']),
        ];
    }

    private static function encode(array $session): string
    {
        $payload = self::base64UrlEncode(json_encode($session, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        $signature = self::base64UrlEncode(hash_hmac('sha256', $payload, self::secret(), true));
        return $payload . '.' . $signature;
    }

    private static function decode(string $token): ?array
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) {
            return null;
        }
        [$payload, $signature] = $parts;
        $expected = self::base64UrlEncode(hash_hmac('sha256', $payload, self::secret(), true));
        if (!hash_equals($expected, $signature)) {
            return null;
        }

        $decoded = self::base64UrlDecode($payload);
        if ($decoded === null) {
            return null;
        }
        $session = json_decode($decoded, true);
        if (!is_array($session)
            || !is_string($session['username'] ?? null)
            || !is_string($session['role'] ?? null)
            || !is_string($session['csrf'] ?? null)
            || !is_int($session['iat'] ?? null)
            || !is_int($session['exp'] ?? null)) {
            return null;
        }
        return $session;
    }

    private static function writeCookie(string $value, int $expiresAt): void
    {
        setcookie(self::cookieName(), $value, [
            'expires' => $expiresAt,
            'path' => '/',
            'secure' => self::secureCookies(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    private static function clearCookie(): void
    {
        setcookie(self::cookieName(), '', [
            'expires' => 1,
            'path' => '/',
            'secure' => self::secureCookies(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    private static function cookieName(): string
    {
        return self::secureCookies() ? self::PRODUCTION_COOKIE : self::LOCAL_COOKIE;
    }

    private static function secureCookies(): bool
    {
        return getenv('VERCEL') === '1'
            || getenv('ZONE_SECURE_COOKIES') === '1'
            || (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off');
    }

    private static function assertConfigured(): void
    {
        if (!self::credentialsConfigured()) {
            throw new RuntimeException('Admin authentication is not configured.');
        }
    }

    private static function username(): string
    {
        return trim((string) (getenv('ZONE_ADMIN_USERNAME') ?: ''));
    }

    private static function passwordHash(): string
    {
        return (string) (getenv('ZONE_ADMIN_PASSWORD_HASH') ?: '');
    }

    private static function secret(): string
    {
        return (string) (getenv('ZONE_ADMIN_SESSION_SECRET') ?: '');
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): ?string
    {
        $remainder = strlen($value) % 4;
        if ($remainder > 0) {
            $value .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        return $decoded === false ? null : $decoded;
    }
}

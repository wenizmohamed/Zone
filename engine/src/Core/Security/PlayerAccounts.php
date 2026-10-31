<?php
declare(strict_types=1);

namespace Zone\Engine\Core\Security;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Persistence\Database;

/** Permanent claiming of existing characters. No client-supplied player IDs. */
final readonly class PlayerAccounts
{
    public function __construct(private Database $database) {}

    public function status(string $token, ?int $now = null): array
    {
        $player = (new BrowserSessions($this->database))->resolve($token, $now);
        $row = $this->database->fetchOne('SELECT p.username, c.login_name FROM players p LEFT JOIN player_credentials c ON c.player_id = p.id WHERE p.id = :id', ['id' => $player]);
        return ['playerId' => $player, 'username' => $row['username'], 'claimed' => $row['login_name'] !== null];
    }

    public function claim(string $token, string $username, string $password, string $address, ?int $now = null): array
    {
        $now ??= time();
        $this->limit($address, $now);
        $name = self::username($username);
        $hash = self::passwordHash($password);
        $sessions = new BrowserSessions($this->database);
        $player = $sessions->resolve($token, $now);
        return $this->database->playerTransaction($player, function () use ($player, $token, $username, $name, $hash, $sessions, $address, $now): array {
            // Recheck after the player lock, including concurrent claiming/recovery.
            $sessions->resolve($token, $now);
            if ($this->database->fetchOne('SELECT player_id FROM player_credentials WHERE player_id = :id', ['id' => $player])) throw new RuntimeException('Account is already claimed.');
            if ($this->database->fetchOne('SELECT id FROM players WHERE LOWER(username) = :name AND id <> :id', ['name' => $name, 'id' => $player])) throw new RuntimeException('Username is unavailable.');
            $recovery = bin2hex(random_bytes(32));
            $inserted = $this->database->execute('INSERT INTO player_credentials (player_id, login_name, password_hash, recovery_hash, created_at, updated_at) VALUES (:id, :name, :password, :recovery, :created, :updated) ON CONFLICT (login_name) DO NOTHING',
                ['id' => $player, 'name' => $name, 'password' => $hash, 'recovery' => hash('sha256', $recovery), 'created' => $now, 'updated' => $now]);
            if ($inserted !== 1) throw new RuntimeException('Username is unavailable.');
            $this->database->execute('UPDATE players SET username = :name WHERE id = :id', ['name' => trim($username), 'id' => $player]);
            $this->database->execute('DELETE FROM browser_sessions WHERE player_id = :id', ['id' => $player]);
            $this->audit($player, 'claimed', $address, $now);
            return [...$sessions->issue($player, $now), 'recoveryCode' => $recovery, 'claimed' => true];
        });
    }

    public function login(string $username, string $password, string $address, string $previousToken = '', ?int $now = null): array
    {
        $now ??= time();
        $this->limit($address, $now);
        $row = $this->database->fetchOne('SELECT player_id, password_hash FROM player_credentials WHERE login_name = :name', ['name' => strtolower(trim($username))]);
        // Bound input before running a slow KDF. Missing names pay the same hash cost.
        self::validatePassword($password);
        if ($row === null) { self::passwordHash($password); $valid = false; }
        else $valid = password_verify($password, $row['password_hash']);
        if (!$valid) {
            $this->audit(null, 'login-failed', $address, $now);
            throw new RuntimeException('Invalid account credentials.');
        }
        return $this->database->playerTransaction($row['player_id'], function () use ($row, $previousToken, $address, $now): array {
            $current = $this->database->fetchOne('SELECT password_hash FROM player_credentials WHERE player_id = :id', ['id' => $row['player_id']]);
            if (!hash_equals($row['password_hash'], $current['password_hash'])) throw new RuntimeException('Invalid account credentials.');
            $sessions = new BrowserSessions($this->database);
            if ($previousToken !== '') $sessions->revoke($previousToken);
            $this->audit($row['player_id'], 'signed-in', $address, $now);
            return [...$sessions->issue($row['player_id'], $now), 'claimed' => true];
        });
    }

    /** Offline backup secret, single-use: password reset rotates it and all sessions. */
    public function recover(string $username, string $code, string $password, string $address, ?int $now = null): array
    {
        $now ??= time();
        $this->limit($address, $now);
        $row = $this->database->fetchOne('SELECT player_id, recovery_hash FROM player_credentials WHERE login_name = :name', ['name' => strtolower(trim($username))]);
        $code = strtolower(trim($code));
        if ($row === null || !preg_match('/^[a-f0-9]{64}$/D', $code) || !hash_equals($row['recovery_hash'], hash('sha256', $code))) {
            $this->audit(null, 'recovery-failed', $address, $now);
            throw new RuntimeException('Invalid account credentials.');
        }
        $passwordHash = self::passwordHash($password);
        return $this->database->playerTransaction($row['player_id'], function () use ($row, $passwordHash, $address, $now): array {
            $replacement = bin2hex(random_bytes(32));
            $updated = $this->database->execute('UPDATE player_credentials SET password_hash = :password, recovery_hash = :new, updated_at = :now WHERE player_id = :id AND recovery_hash = :old',
                ['password' => $passwordHash, 'new' => hash('sha256', $replacement), 'now' => $now, 'id' => $row['player_id'], 'old' => $row['recovery_hash']]);
            if ($updated !== 1) throw new RuntimeException('Invalid account credentials.');
            $this->database->execute('DELETE FROM browser_sessions WHERE player_id = :id', ['id' => $row['player_id']]);
            $this->audit($row['player_id'], 'recovered', $address, $now);
            return [...(new BrowserSessions($this->database))->issue($row['player_id'], $now), 'recoveryCode' => $replacement, 'claimed' => true];
        });
    }

    private static function username(string $name): string
    {
        $name = strtolower(trim($name));
        if (!preg_match('/^[a-z][a-z0-9_]{2,23}$/D', $name) || in_array($name, ['admin', 'system', 'moderator', 'zone'], true) || str_starts_with($name, 'player_')) throw new InvalidArgumentException('Use 3-24 Latin letters, digits or underscores, starting with a letter. This name may be reserved.');
        return $name;
    }

    private static function validatePassword(string $password): void
    {
        $length = preg_match_all('/./us', $password);
        if ($length === false || $length < 15 || $length > 128 || strlen($password) > 1024 || str_contains($password, "\0") || trim($password) === '') throw new InvalidArgumentException('Use a password of 15-128 characters.');
        if (!defined('PASSWORD_ARGON2ID') && strlen($password) > 72) throw new InvalidArgumentException('This server supports passwords of at most 72 bytes.');
    }

    private static function passwordHash(string $password): string
    {
        self::validatePassword($password);
        return defined('PASSWORD_ARGON2ID')
            ? password_hash($password, PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1])
            : password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    private function limit(string $address, int $now): void
    {
        // Shared login/claim/recovery bucket: endpoints cannot bypass each other's cap.
        $bucket = hash('sha256', 'account-auth:' . $address);
        $this->database->execute('INSERT INTO account_auth_limits (bucket, window_started_at, count) VALUES (:bucket, :now, 1) ON CONFLICT (bucket) DO UPDATE SET count = CASE WHEN account_auth_limits.window_started_at <= :floor THEN 1 ELSE account_auth_limits.count + 1 END, window_started_at = CASE WHEN account_auth_limits.window_started_at <= :floor2 THEN :now2 ELSE account_auth_limits.window_started_at END',
            ['bucket' => $bucket, 'now' => $now, 'floor' => $now - 900, 'floor2' => $now - 900, 'now2' => $now]);
        $rate = $this->database->fetchOne('SELECT count FROM account_auth_limits WHERE bucket = :bucket', ['bucket' => $bucket]);
        if ((int) $rate['count'] > 10) throw new RuntimeException('Too many account attempts. Try again in 15 minutes.');
    }

    private function audit(?string $player, string $action, string $address, int $now): void
    {
        $this->database->execute('INSERT INTO account_security_events (id, player_id, action, client_hash, created_at) VALUES (:id, :player, :action, :client, :now)',
            ['id' => bin2hex(random_bytes(16)), 'player' => $player, 'action' => $action, 'client' => hash('sha256', $address), 'now' => $now]);
    }

    public function claimedCount(): int
    {
        $row = $this->database->fetchOne('SELECT COUNT(*) AS total FROM player_credentials');
        return (int) ($row['total'] ?? 0);
    }
}
